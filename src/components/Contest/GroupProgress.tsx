import { useState, useEffect, useMemo } from 'react';
import { Trophy, Flame, Target, Crown, Medal, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString, getYesterdayString, contestDurationDays } from '../../lib/dateUtils';
import { NudgeModal } from './NudgeModal';
import { submissionMetricValue, type MetricDef } from '../../lib/habitAnalytics';

type Participant = {
  id: string;
  user_id: string;
  role: 'admin' | 'participant';
  profiles:
    | {
        email: string;
        full_name: string | null;
      }
    | {
        email: string;
        full_name: string | null;
      }[]
    | null;
};

type LeaderboardEntry = {
  participant: Participant;
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  lastEntry: string | null;
  status: 'on_streak' | 'missed_today' | 'dropped';
  metricTotals: Record<string, number>;
};

type LeaderboardProps = {
  contestId: string;
  startDate: string;
  endDate: string;
  currentUserId?: string;
  metrics?: MetricDef[] | unknown;
};

type SortKey = 'streak' | 'entries' | string;

const POKE_COOLDOWN_MS = 120_000;

function normalizeMetrics(raw: unknown): MetricDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map((m: Record<string, unknown>, i) => ({
      name: String(m.name ?? `metric_${i}`),
      label: String(m.label ?? m.name ?? `Metric ${i + 1}`),
      unit: String(m.unit ?? ''),
      type: m.type === 'boolean' ? ('boolean' as const) : ('number' as const),
    }));
}

function participantName(p: Participant): string {
  const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
  if (!profile?.email) return 'Member';
  return profile.full_name?.trim() || profile.email.split('@')[0] || 'Member';
}

export function GroupProgress({
  contestId,
  startDate,
  endDate,
  currentUserId,
  metrics: metricsProp,
}: LeaderboardProps) {
  const metrics = useMemo(() => normalizeMetrics(metricsProp), [metricsProp]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('streak');
  const [pokeSentAt, setPokeSentAt] = useState<Record<string, number>>({});
  const [nudgeTarget, setNudgeTarget] = useState<{ userId: string; name: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [contestId, metrics]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .is('left_at', null);

      if (participantsError) throw participantsError;

      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('participant_id, submission_date, streak_count, metric_values')
        .eq('contest_id', contestId)
        .order('submission_date', { ascending: true });

      if (submissionsError) throw submissionsError;

      const todayStr = getTodayString();
      const yesterdayStr = getYesterdayString();

      const leaderboardData: LeaderboardEntry[] = (participants || []).map((participant) => {
        const participantSubmissions = (submissions || []).filter(
          (s) => s.participant_id === participant.id
        );

        const totalEntries = participantSubmissions.length;
        const currentStreak =
          participantSubmissions.length > 0
            ? participantSubmissions[participantSubmissions.length - 1].streak_count || 0
            : 0;
        const longestStreak = participantSubmissions.reduce(
          (max, s) => Math.max(max, s.streak_count || 0),
          0
        );
        const lastEntry =
          participantSubmissions.length > 0
            ? participantSubmissions[participantSubmissions.length - 1].submission_date
            : null;

        const todaySubmission = participantSubmissions.find((s) => s.submission_date === todayStr);
        const yesterdaySubmission = participantSubmissions.find((s) => s.submission_date === yesterdayStr);

        let status: 'on_streak' | 'missed_today' | 'dropped';
        if (todaySubmission) {
          status = 'on_streak';
        } else if (yesterdaySubmission) {
          status = 'missed_today';
        } else {
          status = 'dropped';
        }

        const metricTotals: Record<string, number> = {};
        metrics.forEach((metric) => {
          if (metric.type === 'number') {
            metricTotals[metric.name] = participantSubmissions.reduce(
              (sum, s) => sum + submissionMetricValue(s, metric),
              0
            );
          } else {
            metricTotals[metric.name] = participantSubmissions.filter(
              (s) => submissionMetricValue(s, metric) === 1
            ).length;
          }
        });

        return {
          participant,
          totalEntries,
          currentStreak,
          longestStreak,
          lastEntry,
          status,
          metricTotals,
        };
      });

      setEntries(leaderboardData);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Could not load leaderboard');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePokeSent = (toUserId: string) => {
    setPokeSentAt((prev) => ({ ...prev, [toUserId]: Date.now() }));
  };

  const pokeCooldownRemaining = (toUserId: string) => {
    const last = pokeSentAt[toUserId];
    if (!last) return 0;
    const left = POKE_COOLDOWN_MS - (now - last);
    return left > 0 ? Math.ceil(left / 1000) : 0;
  };

  const sortMetric = useMemo(() => {
    if (sortBy.startsWith('metric:')) {
      return metrics.find((m) => m.name === sortBy.slice(7));
    }
    return undefined;
  }, [sortBy, metrics]);

  const sortedEntries = useMemo(() => {
    const valueFor = (entry: LeaderboardEntry): number => {
      if (sortBy === 'entries') return entry.totalEntries;
      if (sortBy === 'streak') return entry.currentStreak;
      if (sortMetric) return entry.metricTotals[sortMetric.name] ?? 0;
      return entry.currentStreak;
    };

    return [...entries].sort((a, b) => {
      const diff = valueFor(b) - valueFor(a);
      if (diff !== 0) return diff;
      if (sortBy === 'streak') return b.longestStreak - a.longestStreak;
      return b.totalEntries - a.totalEntries;
    });
  }, [entries, sortBy, sortMetric]);

  const primaryLabel = useMemo(() => {
    if (sortBy === 'entries') return 'Entries';
    if (sortBy === 'streak') return 'Current streak';
    if (sortMetric?.label) return sortMetric.label;
    return 'Current streak';
  }, [sortBy, sortMetric]);

  const contestDays = useMemo(
    () => contestDurationDays(startDate, endDate),
    [startDate, endDate]
  );

  const formatPrimaryValue = (entry: LeaderboardEntry) => {
    if (sortBy === 'entries') return String(entry.totalEntries);
    if (sortBy === 'streak') {
      return entry.longestStreak > entry.currentStreak
        ? `${entry.currentStreak}d · best ${entry.longestStreak}d`
        : `${entry.currentStreak}d`;
    }
    if (sortMetric) {
      const v = Math.round((entry.metricTotals[sortMetric.name] ?? 0) * 100) / 100;
      if (sortMetric.type === 'boolean') return `${v} days`;
      return sortMetric.unit ? `${v} ${sortMetric.unit}` : String(v);
    }
    return `${entry.currentStreak}d`;
  };

  const sortButtons: { key: SortKey; label: string; icon: typeof Flame }[] = [
    { key: 'streak', label: 'Streak', icon: Flame },
    { key: 'entries', label: 'Entries', icon: Target },
    ...metrics.map((m) => ({
      key: `metric:${m.name}` as SortKey,
      label: m.label,
      icon: Trophy,
    })),
  ];

  const getRankDisplay = (index: number) => {
    if (index === 0) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full shrink-0">
          <Trophy className="w-6 h-6 text-white" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full shrink-0">
          <Medal className="w-6 h-6 text-white" />
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full shrink-0">
          <Medal className="w-6 h-6 text-white" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full shrink-0">
        <span className="font-bold text-gray-700">{index + 1}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <div className="flex items-start gap-3 text-red-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load leaderboard</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="mt-3 px-3 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 rounded-lg"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" />
            Leaderboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by {primaryLabel.toLowerCase()} · {entries.length} member
            {entries.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {sortButtons.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition inline-flex items-center gap-1.5 ${
              sortBy === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sortedEntries.map((entry, index) => {
          const isCurrentUser = entry.participant.user_id === currentUserId;
          const cooldown = pokeCooldownRemaining(entry.participant.user_id);
          const showPoke = currentUserId && !isCurrentUser;
          const lastEntryLabel = entry.lastEntry
            ? new Date(`${entry.lastEntry}T12:00:00`).toLocaleDateString()
            : 'No entries yet';

          return (
            <div
              key={entry.participant.id}
              className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl transition ${
                isCurrentUser
                  ? 'bg-emerald-50 border-2 border-emerald-300'
                  : 'bg-gray-50 border border-transparent hover:bg-gray-100'
              }`}
            >
              {getRankDisplay(index)}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">
                    {participantName(entry.participant)}
                  </p>
                  {isCurrentUser && (
                    <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">You</span>
                  )}
                  {entry.participant.role === 'admin' && (
                    <Crown className="w-4 h-4 text-yellow-600 shrink-0" />
                  )}
                  {entry.status === 'on_streak' && entry.currentStreak > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      <Flame className="w-3 h-3" />
                      Active
                    </span>
                  )}
                  {entry.status === 'missed_today' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      Missed today
                    </span>
                  )}
                  {entry.status === 'dropped' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" />
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">Last entry: {lastEntryLabel}</p>
              </div>

              <div className="text-right shrink-0 min-w-[5.5rem] sm:min-w-[7rem]">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{primaryLabel}</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700 leading-tight">
                  {formatPrimaryValue(entry)}
                </p>
                {sortBy !== 'entries' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entry.totalEntries}/{contestDays} days
                  </p>
                )}
              </div>

              {showPoke && (
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() =>
                    setNudgeTarget({
                      userId: entry.participant.user_id,
                      name: participantName(entry.participant),
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{cooldown > 0 ? `${cooldown}s` : 'Nudge'}</span>
                </button>
              )}
            </div>
          );
        })}

        {sortedEntries.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No entries yet. Be the first to log progress!</p>
          </div>
        )}
      </div>

      {nudgeTarget && (
        <NudgeModal
          contestId={contestId}
          toUserId={nudgeTarget.userId}
          toUserName={nudgeTarget.name}
          onClose={() => setNudgeTarget(null)}
          onSent={() => handlePokeSent(nudgeTarget.userId)}
        />
      )}
    </div>
  );
}
