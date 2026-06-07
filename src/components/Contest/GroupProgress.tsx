import { useState, useEffect } from 'react';
import { Trophy, Flame, Target, Crown, Medal, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString, getYesterdayString, parseLocalDate } from '../../lib/dateUtils';
import { sendContestPoke } from '../../lib/pokeParticipant';

type Participant = {
  id: string;
  user_id: string;
  role: 'admin' | 'participant';
  profiles: {
    email: string;
    full_name: string | null;
  };
};

type LeaderboardEntry = {
  participant: Participant;
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  lastEntry: string | null;
  status: 'on_streak' | 'missed_today' | 'dropped';
  metricValue?: number;
};

type LeaderboardProps = {
  contestId: string;
  startDate: string;
  endDate: string;
  currentUserId?: string;
  metrics?: any[];
};

const POKE_COOLDOWN_MS = 120_000;

export function GroupProgress({ contestId, startDate, endDate, currentUserId, metrics = [] }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'entries' | 'streak' | 'metric'>('streak');
  const [pokeSentAt, setPokeSentAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [contestId]);

  const loadLeaderboard = async () => {
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

      const start = parseLocalDate(startDate);
      const end = parseLocalDate(endDate);
      const today = new Date();
      const contestEnd = end < today ? end : today;
      Math.floor((contestEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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

        let metricValue: number | undefined;
        if (metrics.length > 0) {
          const primaryMetric = metrics[0];
          if (primaryMetric.type === 'number') {
            const values = participantSubmissions
              .map((s) => s.metric_values?.[primaryMetric.name])
              .filter((v) => typeof v === 'number');
            metricValue = values.length > 0 ? values.reduce((sum: number, v: number) => sum + v, 0) : 0;
          }
        }

        return {
          participant,
          totalEntries,
          currentStreak,
          longestStreak,
          lastEntry,
          status,
          metricValue,
        };
      });

      setEntries(leaderboardData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePoke = async (toUserId: string) => {
    const last = pokeSentAt[toUserId];
    if (last && Date.now() - last < POKE_COOLDOWN_MS) return;
    const { error } = await sendContestPoke(contestId, toUserId);
    if (error) {
      alert(error.message || 'Could not send nudge');
      return;
    }
    setPokeSentAt((prev) => ({ ...prev, [toUserId]: Date.now() }));
  };

  const pokeCooldownRemaining = (toUserId: string) => {
    const last = pokeSentAt[toUserId];
    if (!last) return 0;
    const left = POKE_COOLDOWN_MS - (now - last);
    return left > 0 ? Math.ceil(left / 1000) : 0;
  };

  const getSortedEntries = () => {
    return [...entries].sort((a, b) => {
      switch (sortBy) {
        case 'entries':
          return b.totalEntries - a.totalEntries;
        case 'streak':
          if (b.currentStreak === a.currentStreak) {
            return b.longestStreak - a.longestStreak;
          }
          return b.currentStreak - a.currentStreak;
        case 'metric':
          return (b.metricValue || 0) - (a.metricValue || 0);
        default:
          return 0;
      }
    });
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full">
          <Trophy className="w-6 h-6 text-white" />
        </div>
      );
    } else if (index === 1) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full">
          <Medal className="w-6 h-6 text-white" />
        </div>
      );
    } else if (index === 2) {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full">
          <Medal className="w-6 h-6 text-white" />
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
          <span className="font-bold text-gray-700">{index + 1}</span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const sortedEntries = getSortedEntries();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-600" />
          Group Progress
        </h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSortBy('streak')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
            sortBy === 'streak'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Flame className="w-4 h-4 inline mr-1" />
          Streak
        </button>
        <button
          onClick={() => setSortBy('entries')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
            sortBy === 'entries'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Target className="w-4 h-4 inline mr-1" />
          Entries
        </button>
        {metrics.length > 0 && metrics[0].type === 'number' && (
          <button
            onClick={() => setSortBy('metric')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              sortBy === 'metric'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-1" />
            {metrics[0].label}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {sortedEntries.map((entry, index) => {
          const isCurrentUser = entry.participant.user_id === currentUserId;
          const cooldown = pokeCooldownRemaining(entry.participant.user_id);
          const showPoke = currentUserId && !isCurrentUser;
          const lastEntryLabel = entry.lastEntry
            ? new Date(`${entry.lastEntry}T12:00:00`).toLocaleDateString()
            : null;

          return (
            <div
              key={entry.participant.id}
              className={`flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-4 p-4 rounded-lg transition ${
                isCurrentUser
                  ? 'bg-emerald-50 border-2 border-emerald-300'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start gap-3 sm:items-center shrink-0">
                {getRankDisplay(index)}
                {showPoke && (
                  <button
                    type="button"
                    disabled={cooldown > 0}
                    onClick={() => handlePoke(entry.participant.user_id)}
                    className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {cooldown > 0 ? `${cooldown}s` : 'Nudge'}
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                    <p className="font-semibold text-gray-900 break-words">
                      {entry.participant.profiles.full_name || entry.participant.profiles.email}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-1 rounded-full whitespace-nowrap">
                          You
                        </span>
                      )}
                    </p>
                    {entry.participant.role === 'admin' && (
                      <Crown className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    )}
                    {entry.status === 'on_streak' && entry.currentStreak > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <Flame className="w-3 h-3" />
                        On streak
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
                        Dropped
                      </span>
                    )}
                  </div>
                  {showPoke && (
                    <button
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => handlePoke(entry.participant.user_id)}
                      className="hidden sm:inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0 self-start"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {cooldown > 0 ? `Wait ${cooldown}s` : 'Nudge'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-600 text-xs">Entries</p>
                    <p className="font-bold text-gray-900">{entry.totalEntries}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-600 text-xs flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500 shrink-0" />
                      Streak
                    </p>
                    <p className="font-bold text-gray-900">
                      {entry.currentStreak}
                      {entry.longestStreak > entry.currentStreak && (
                        <span className="text-xs text-gray-500 ml-1">({entry.longestStreak} best)</span>
                      )}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-600 text-xs truncate">
                      {metrics.length > 0 && metrics[0].type === 'number' ? metrics[0].label : 'Total'}
                    </p>
                    <p className="font-bold text-emerald-600">
                      {entry.metricValue !== undefined
                        ? Math.round(entry.metricValue * 100) / 100
                        : entry.currentStreak}
                      {metrics.length > 0 && metrics[0].type === 'number' && (
                        <span className="text-xs text-gray-500 ml-1">{metrics[0].unit}</span>
                      )}
                    </p>
                  </div>
                </div>

                {lastEntryLabel && (
                  <p className="text-xs text-gray-500 mt-2">Last entry: {lastEntryLabel}</p>
                )}
              </div>
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
    </div>
  );
}
