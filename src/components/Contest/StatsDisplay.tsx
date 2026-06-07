import { useState, useEffect } from 'react';
import { Flame, AlertTriangle, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getLocalDateString, getTodayString } from '../../lib/dateUtils';

type Metric = {
  id: string;
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

type Submission = {
  id: string;
  submission_date: string;
  metric_values: Record<string, any>;
  streak_count: number;
  participant_id: string;
};

type Participant = {
  id: string;
  user_id: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
};

type StatsDisplayProps = {
  contestId: string;
  participantId: string;
  metrics: Metric[];
  startDate: string;
};

export function StatsDisplay({
  contestId,
  participantId,
  metrics,
  startDate,
}: StatsDisplayProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [contestId, participantId]);

  const loadData = async () => {
    try {
      const { data: userSubmissions, error: userError } = await supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .eq('participant_id', participantId)
        .order('submission_date', { ascending: true });

      if (userError) throw userError;
      setSubmissions(userSubmissions || []);

      const { data: groupSubmissions, error: groupError } = await supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .order('submission_date', { ascending: true });

      if (groupError) throw groupError;
      setAllSubmissions(groupSubmissions || []);

      const { data: participantsData, error: participantsError } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .is('left_at', null);

      if (participantsError) throw participantsError;
      setParticipants(participantsData || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStreakGraphData = () => {
    const start = new Date(startDate + 'T00:00:00');
    const todayStr = getTodayString();

    const graphData: { date: string; streak: number; label: string }[] = [];
    const submissionMap = new Map(submissions.map((s) => [s.submission_date, s.streak_count]));

    let currentDate = new Date(start);
    while (getLocalDateString(currentDate) <= todayStr) {
      const dateStr = getLocalDateString(currentDate);
      const streak = submissionMap.get(dateStr) || 0;
      const label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      graphData.push({ date: dateStr, streak, label });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return graphData.slice(-30);
  };

  const getGroupWarnings = () => {
    const todayStr = getTodayString();

    const warnings: { type: 'danger' | 'warning'; message: string; names: string[] }[] = [];

    const participantsMissedToday: string[] = [];
    const participantsMissedMultiple: string[] = [];

    participants.forEach((participant) => {
      const participantSubs = allSubmissions.filter((s) => s.participant_id === participant.id);
      const todaySubmission = participantSubs.find((s) => s.submission_date === todayStr);

      const name = participant.profiles.full_name || participant.profiles.email.split('@')[0];

      if (!todaySubmission) {
        participantsMissedToday.push(name);

        const last3Days = [];
        for (let i = 0; i < 3; i++) {
          const checkDate = new Date();
          checkDate.setDate(checkDate.getDate() - i);
          const checkDateStr = getLocalDateString(checkDate);
          const submission = participantSubs.find((s) => s.submission_date === checkDateStr);
          if (submission) {
            last3Days.push(checkDateStr);
          }
        }

        if (last3Days.length === 0) {
          participantsMissedMultiple.push(name);
        }
      }
    });

    if (participantsMissedMultiple.length > 0) {
      warnings.push({
        type: 'danger',
        message: 'Group streak at risk! These members have missed 3+ days',
        names: participantsMissedMultiple,
      });
    }

    if (participantsMissedToday.length > 0 && participantsMissedMultiple.length === 0) {
      warnings.push({
        type: 'warning',
        message: 'Some members haven\'t logged today',
        names: participantsMissedToday,
      });
    }

    return warnings;
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

  const graphData = getStreakGraphData();
  const warnings = getGroupWarnings();
  const maxStreak = Math.max(...graphData.map((d) => d.streak), 10);
  const currentStreak = submissions.length > 0 ? submissions[submissions.length - 1].streak_count || 0 : 0;
  const longestStreak = submissions.reduce((max, s) => Math.max(max, s.streak_count || 0), 0);

  return (
    <div className="space-y-6">
      {warnings.length > 0 && (
        <div className="space-y-3">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className={`rounded-xl p-4 border-2 ${
                warning.type === 'danger'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-yellow-50 border-yellow-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`w-6 h-6 mt-0.5 ${
                    warning.type === 'danger' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`font-bold mb-2 ${
                      warning.type === 'danger' ? 'text-red-900' : 'text-yellow-900'
                    }`}
                  >
                    {warning.message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {warning.names.map((name) => (
                      <span
                        key={name}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          warning.type === 'danger'
                            ? 'bg-red-200 text-red-900'
                            : 'bg-yellow-200 text-yellow-900'
                        }`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  {warning.type === 'danger' && (
                    <p className="text-sm text-red-700 mt-2">
                      Group rule: No one can miss more than 2 days or the group loses its streak!
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            Your Streak Progress
          </h3>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-600">Current</p>
              <p className="text-2xl font-bold text-orange-600">{currentStreak}d</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Best</p>
              <p className="text-2xl font-bold text-emerald-600">{longestStreak}d</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="flex items-end justify-between gap-1 h-64 border-b border-l border-gray-200 pb-2 pl-2">
            {graphData.map((point) => {
              const heightPercent = maxStreak > 0 ? (point.streak / maxStreak) * 100 : 0;
              const isToday = point.date === getTodayString();

              return (
                <div key={point.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      point.streak > 0
                        ? isToday
                          ? 'bg-blue-500'
                          : 'bg-emerald-500'
                        : 'bg-gray-200'
                    } hover:opacity-80`}
                    style={{ height: `${heightPercent}%`, minHeight: point.streak > 0 ? '4px' : '2px' }}
                  ></div>

                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {point.label}: {point.streak > 0 ? `${point.streak}d streak` : 'No entry'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{graphData[0]?.label}</span>
            <span>Last 30 days</span>
            <span>{graphData[graphData.length - 1]?.label}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          Metric Performance
        </h3>
        <div className="space-y-4">
          {metrics.map((metric) => {
            if (metric.type === 'boolean') {
              const totalEntries = submissions.filter((s) => s.metric_values[metric.name] !== undefined).length;
              const completedCount = submissions.filter((s) => s.metric_values[metric.name] === true).length;
              const rate = totalEntries > 0 ? Math.round((completedCount / totalEntries) * 100) : 0;

              return (
                <div key={metric.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{metric.label}</h4>
                    <span className="text-sm font-bold text-emerald-600">{rate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{completedCount} completed</span>
                    <span>{totalEntries} total</span>
                  </div>
                </div>
              );
            } else {
              const values = submissions
                .filter((s) => typeof s.metric_values[metric.name] === 'number')
                .map((s) => s.metric_values[metric.name] as number);

              const total = values.reduce((sum, v) => sum + v, 0);
              const average = values.length > 0 ? total / values.length : 0;
              const max = values.length > 0 ? Math.max(...values) : 0;

              return (
                <div key={metric.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{metric.label}</h4>
                    <span className="text-sm text-gray-500">{metric.unit}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total</p>
                      <p className="font-bold text-gray-900">{Math.round(total * 100) / 100}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Average</p>
                      <p className="font-bold text-gray-900">{Math.round(average * 100) / 100}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Best</p>
                      <p className="font-bold text-emerald-600">{Math.round(max * 100) / 100}</p>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
