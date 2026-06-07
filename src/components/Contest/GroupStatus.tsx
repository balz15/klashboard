import { useState, useEffect } from 'react';
import { Users, Flame, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString, getYesterdayString, parseLocalDate } from '../../lib/dateUtils';
import { sendContestPoke } from '../../lib/pokeParticipant';

type Participant = {
  id: string;
  user_id: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
};

type ParticipantStatus = {
  participant: Participant;
  status: 'on_track' | 'missed_today' | 'falling_behind';
  currentStreak: number;
  lastSubmission: string | null;
  missedDays: number;
};

type GroupStatusProps = {
  contestId: string;
  startDate: string;
  currentUserId?: string;
};

const POKE_COOLDOWN_MS = 120_000;

export function GroupStatus({ contestId, startDate, currentUserId }: GroupStatusProps) {
  const [statuses, setStatuses] = useState<ParticipantStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pokeSentAt, setPokeSentAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    loadGroupStatus();
    const interval = setInterval(loadGroupStatus, 30000);
    return () => clearInterval(interval);
  }, [contestId]);

  const loadGroupStatus = async () => {
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .is('left_at', null);

      if (participantsError) throw participantsError;

      const todayStr = getTodayString();
      const yesterdayStr = getYesterdayString();
      const today = new Date();

      const { data: allSubmissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .order('submission_date', { ascending: false });

      if (submissionsError) throw submissionsError;

      const statusList: ParticipantStatus[] = (participants || []).map((participant) => {
        const participantSubmissions = allSubmissions?.filter(
          (s) => s.participant_id === participant.id
        ) || [];

        const todaySubmission = participantSubmissions.find((s) => s.submission_date === todayStr);
        const yesterdaySubmission = participantSubmissions.find((s) => s.submission_date === yesterdayStr);

        const latestSubmission = participantSubmissions[0];
        const currentStreak = latestSubmission?.streak_count || 0;
        const lastSubmissionDate = latestSubmission?.submission_date || null;

        const contestStart = parseLocalDate(startDate);

        const totalPossibleDays = Math.floor((today.getTime() - contestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalSubmissions = participantSubmissions.length;
        const missedDays = Math.max(0, totalPossibleDays - totalSubmissions);

        let status: 'on_track' | 'missed_today' | 'falling_behind';

        if (todaySubmission) {
          status = 'on_track';
        } else if (!todaySubmission && yesterdaySubmission) {
          status = 'missed_today';
        } else {
          status = 'falling_behind';
        }

        return {
          participant,
          status,
          currentStreak,
          lastSubmission: lastSubmissionDate,
          missedDays,
        };
      });

      statusList.sort((a, b) => {
        const statusOrder = { on_track: 0, missed_today: 1, falling_behind: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return b.currentStreak - a.currentStreak;
      });

      setStatuses(statusList);
    } catch (error) {
      console.error('Error loading group status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, _streak: number) => {
    switch (status) {
      case 'on_track':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
            <Flame className="w-3 h-3" />
            On streak
          </div>
        );
      case 'missed_today':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Missed today
          </div>
        );
      case 'falling_behind':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Dropped off
          </div>
        );
      default:
        return null;
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

  const getStatusSection = (status: string) => {
    const filtered = statuses.filter((s) => s.status === status);
    if (filtered.length === 0) return null;

    const title =
      status === 'on_track'
        ? "Who's on track"
        : status === 'missed_today'
        ? "Who's slipping"
        : "Who's dropped";

    const bgColor =
      status === 'on_track'
        ? 'bg-emerald-50 border-emerald-200'
        : status === 'missed_today'
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-red-50 border-red-200';

    return (
      <div className={`border rounded-lg p-4 ${bgColor}`}>
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">{title}</h3>
        <div className="space-y-2">
          {filtered.map((item) => {
            const name = item.participant.profiles.full_name || item.participant.profiles.email.split('@')[0];
            const cooldown = pokeCooldownRemaining(item.participant.user_id);
            const showPoke =
              currentUserId && item.participant.user_id !== currentUserId;

            return (
              <div
                key={item.participant.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-600">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                    {item.currentStreak > 0 && (
                      <p className="text-xs text-gray-600">
                        {item.currentStreak} day streak
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end shrink-0">
                  {getStatusBadge(item.status, item.currentStreak)}
                  {showPoke && (
                    <button
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => handlePoke(item.participant.user_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {cooldown > 0 ? `Wait ${cooldown}s` : 'Nudge'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="inline-block w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const onTrack = statuses.filter((s) => s.status === 'on_track').length;
  const missedToday = statuses.filter((s) => s.status === 'missed_today').length;
  const fallingBehind = statuses.filter((s) => s.status === 'falling_behind').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-emerald-600" />
        Group Status
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="text-center p-4 bg-emerald-50 rounded-lg">
          <p className="text-2xl font-bold text-emerald-600">{onTrack}</p>
          <p className="text-xs text-gray-600 mt-1">On track</p>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <p className="text-2xl font-bold text-yellow-600">{missedToday}</p>
          <p className="text-xs text-gray-600 mt-1">Slipping</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-600">{fallingBehind}</p>
          <p className="text-xs text-gray-600 mt-1">Dropped</p>
        </div>
      </div>

      <div className="space-y-4">
        {getStatusSection('on_track')}
        {getStatusSection('missed_today')}
        {getStatusSection('falling_behind')}
      </div>
    </div>
  );
}
