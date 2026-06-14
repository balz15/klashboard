import { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Calendar,
  TrendingUp,
  History,
  Target,
  Share2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Users,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString } from '../../lib/dateUtils';
import {
  buildCalendarMonth,
  buildCumulativeSeries,
  buildPeriodHistory,
  computeBestStreakFromDates,
  computeCurrentStreak,
  computeGroupPerfectStreak,
  computeBestGroupPerfectStreak,
  aggregateGroupSubmissions,
  scaleGoalsForGroup,
  currentPeriodTotals,
  type SubmissionRow,
  type SubmissionWithParticipant,
  type MetricDef,
} from '../../lib/habitAnalytics';
import {
  parseScoringRules,
  getMetricGoals,
  defaultGoalsForMetric,
  PERIOD_LABELS,
  type StatsPeriod,
  type ScoringRules,
} from '../../lib/challengeGoals';
import { ShareStatsModal } from './ShareStatsModal';

type ParticipantOption = {
  id: string;
  name: string;
  isSelf?: boolean;
};

type HabitAnalyticsProps = {
  contestId: string;
  participantId: string;
  metrics: MetricDef[];
  startDate: string;
  endDate: string;
  scoringRules?: Record<string, unknown>;
  contestName: string;
  userDisplayName: string;
  participants?: ParticipantOption[];
};

const PERIODS: StatsPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

type ViewTab = 'overview' | 'calendar' | 'graph' | 'history' | 'score';
type StatsScope = 'individual' | 'group';

export function HabitAnalytics({
  contestId,
  participantId,
  metrics,
  startDate,
  endDate,
  scoringRules: scoringRulesRaw,
  contestName,
  userDisplayName,
  participants = [],
}: HabitAnalyticsProps) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<SubmissionWithParticipant[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<StatsScope>('individual');
  const [viewParticipantId, setViewParticipantId] = useState(participantId);
  const [metricIndex, setMetricIndex] = useState(0);
  const [view, setView] = useState<ViewTab>('overview');
  const [period, setPeriod] = useState<StatsPeriod>('weekly');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showShare, setShowShare] = useState(false);

  const rules: ScoringRules = parseScoringRules(scoringRulesRaw);
  const metric = metrics[metricIndex] ?? metrics[0];
  const viewingSelf = viewParticipantId === participantId;
  const canShare = scope === 'individual' && viewingSelf;

  const selectedParticipant = participants.find((p) => p.id === viewParticipantId);
  const displayName =
    scope === 'group'
      ? 'Everyone'
      : selectedParticipant?.name || userDisplayName;

  useEffect(() => {
    setViewParticipantId(participantId);
  }, [participantId]);

  useEffect(() => {
    loadData();
  }, [contestId, viewParticipantId, scope]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: members, error: membersError } = await supabase
        .from('contest_participants')
        .select('id')
        .eq('contest_id', contestId)
        .is('left_at', null);
      if (membersError) throw membersError;
      const ids = (members || []).map((m) => m.id);
      setParticipantIds(ids);

      if (scope === 'group') {
        const { data: all, error: allError } = await supabase
          .from('submissions')
          .select('submission_date, metric_values, streak_count, participant_id')
          .eq('contest_id', contestId)
          .order('submission_date', { ascending: true });
        if (allError) throw allError;
        const rows = (all as SubmissionWithParticipant[]) || [];
        setAllSubmissions(rows);
        setSubmissions(metric ? aggregateGroupSubmissions(rows, metric) : []);
      } else {
        const { data: mine, error: e1 } = await supabase
          .from('submissions')
          .select('submission_date, metric_values, streak_count')
          .eq('contest_id', contestId)
          .eq('participant_id', viewParticipantId)
          .order('submission_date', { ascending: true });
        if (e1) throw e1;
        setSubmissions((mine as SubmissionRow[]) || []);
        setAllSubmissions([]);
      }
    } catch (err) {
      console.error('HabitAnalytics load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scope === 'group' && metric && allSubmissions.length >= 0) {
      setSubmissions(aggregateGroupSubmissions(allSubmissions, metric));
    }
  }, [metric?.name, scope, allSubmissions]);

  const goals = useMemo(() => {
    if (!metric) return defaultGoalsForMetric('number');
    const custom = getMetricGoals(rules, metric.name);
    const defaults = defaultGoalsForMetric(metric.type);
    const merged = { ...defaults, ...custom };
    if (scope === 'group') {
      return scaleGoalsForGroup(merged, Math.max(participantIds.length, 1));
    }
    return merged;
  }, [rules, metric, scope, participantIds.length]);

  const entryDates = useMemo(() => submissions.map((s) => s.submission_date), [submissions]);
  const todayStr = getTodayString();
  const currentStreak =
    scope === 'group'
      ? computeGroupPerfectStreak(allSubmissions, participantIds, todayStr)
      : computeCurrentStreak(entryDates, todayStr);
  const bestStreak =
    scope === 'group'
      ? computeBestGroupPerfectStreak(allSubmissions, participantIds)
      : Math.max(
          computeBestStreakFromDates(entryDates),
          submissions.reduce((m, s) => Math.max(m, s.streak_count || 0), 0)
        );

  const cumulative = useMemo(
    () => (metric ? buildCumulativeSeries(submissions, metric, startDate, endDate) : []),
    [submissions, metric, startDate, endDate]
  );

  const history = useMemo(
    () => (metric ? buildPeriodHistory(submissions, metric, period, goals) : []),
    [submissions, metric, period, goals]
  );

  const calendarDays = useMemo(
    () =>
      metric
        ? buildCalendarMonth(
            calendarMonth.getFullYear(),
            calendarMonth.getMonth(),
            submissions,
            metric,
            startDate,
            endDate
          )
        : [],
    [calendarMonth, submissions, metric, startDate, endDate]
  );

  const periodScore = useMemo(
    () => (metric ? currentPeriodTotals(submissions, metric, period, goals) : null),
    [submissions, metric, period, goals]
  );

  const maxCumulative = Math.max(...cumulative.map((p) => p.cumulative), 1);

  if (loading || !metric) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-center h-64">
        <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: ViewTab; label: string; icon: typeof Flame }[] = [
    { id: 'overview', label: 'Streaks', icon: Flame },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'graph', label: 'Trend', icon: TrendingUp },
    { id: 'history', label: 'History', icon: History },
    { id: 'score', label: 'Score', icon: Target },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScope('individual')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
              scope === 'individual' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            Individual
          </button>
          <button
            type="button"
            onClick={() => setScope('group')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
              scope === 'group' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Group
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            {scope === 'individual' && participants.length > 0 && (
              <select
                value={viewParticipantId}
                onChange={(e) => setViewParticipantId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium min-w-[10rem]"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isSelf ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
            {metrics.length > 1 && (
              <select
                value={metricIndex}
                onChange={(e) => setMetricIndex(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
              >
                {metrics.map((m, i) => (
                  <option key={m.name} value={i}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {canShare && (
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Share2 className="w-4 h-4" />
              Share progress
            </button>
          )}
        </div>

        <p className="text-sm text-gray-500">
          {scope === 'group'
            ? `Combined stats for all ${participantIds.length} members`
            : `Stats for ${displayName}`}
          {scope === 'group' && view === 'overview' && (
            <span> · Group streak counts days everyone logged</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-gray-200 p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
              view === id ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <p className="text-xs text-gray-600 mb-1">
                {scope === 'group' ? 'Group streak' : 'Current streak'}
              </p>
              <p className="text-3xl font-bold text-orange-600">{currentStreak}d</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs text-gray-600 mb-1">
                {scope === 'group' ? 'Perfect days' : 'Best streak'}
              </p>
              <p className="text-3xl font-bold text-emerald-600">{bestStreak}d</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl col-span-2 sm:col-span-2">
              <p className="text-xs text-gray-600 mb-1">
                {scope === 'group' ? 'Group log days' : 'Total entries'}
              </p>
              <p className="text-3xl font-bold text-blue-600">{submissions.length}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {scope === 'group' ? 'Group daily total' : 'Daily activity'} (last 30 days)
          </p>
          <div className="flex items-end gap-0.5 h-32 border-b border-l border-gray-200 pl-1 pb-1">
            {cumulative.slice(-30).map((p) => {
              const h = p.daily > 0 ? Math.max(8, (p.daily / Math.max(...cumulative.slice(-30).map((x) => x.daily), 1)) * 100) : 4;
              return (
                <div
                  key={p.date}
                  title={`${p.label}: ${metric.type === 'boolean' ? (p.daily ? 'Done' : '—') : p.daily}`}
                  className={`flex-1 min-w-[4px] rounded-t ${p.daily > 0 ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-gray-900">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {calendarDays.map((day) => {
              let cls = 'aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium ';
              if (!day.inRange || day.inFuture) cls += 'bg-gray-50 text-gray-300';
              else if (day.hasEntry)
                cls += metric.type === 'boolean' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800';
              else cls += 'bg-white border border-gray-200 text-gray-500';
              return (
                <div key={day.date} className={cls} title={day.date}>
                  <span>{parseInt(day.date.slice(8), 10)}</span>
                  {day.hasEntry && metric.type === 'number' && (
                    <span className="text-[10px] leading-none">{day.value}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'graph' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-1">
            Cumulative {metric.label}
            {scope === 'group' ? ' (group total)' : ''}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Running total{metric.unit ? ` (${metric.unit})` : ''} — Habits-style progress curve
          </p>
          <div className="relative h-48 border-b border-l border-gray-200">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(cumulative.length, 1)} 100`}>
              {cumulative.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="0.5"
                  points={cumulative
                    .map((p, i) => `${i},${100 - (p.cumulative / maxCumulative) * 95}`)
                    .join(' ')}
                />
              )}
              {cumulative.length > 1 && (
                <polygon
                  fill="rgba(16,185,129,0.15)"
                  points={`0,100 ${cumulative
                    .map((p, i) => `${i},${100 - (p.cumulative / maxCumulative) * 95}`)
                    .join(' ')} ${cumulative.length - 1},100`}
                />
              )}
            </svg>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{cumulative[0]?.label}</span>
            <span>Total: {cumulative[cumulative.length - 1]?.cumulative ?? 0}</span>
            <span>{cumulative[cumulative.length - 1]?.label}</span>
          </div>
        </div>
      )}

      {(view === 'history' || view === 'score') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  period === p ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {view === 'score' && periodScore && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
              <p className="text-sm text-gray-600">{PERIOD_LABELS[period]} score</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">
                {periodScore.scorePct != null ? `${periodScore.scorePct}%` : periodScore.total}
                {periodScore.scorePct == null && metric.unit ? ` ${metric.unit}` : ''}
              </p>
              {periodScore.goal != null && (
                <p className="text-sm text-gray-600 mt-1">
                  {periodScore.total}
                  {metric.unit ? ` ${metric.unit}` : ''} of {periodScore.goal} goal
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Goal</th>
                  <th className="py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().slice(0, 20).map((row) => (
                  <tr key={row.key} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-900">{row.label}</td>
                    <td className="py-2 pr-4">
                      {row.total}
                      {metric.type === 'number' && metric.unit ? ` ${metric.unit}` : ''}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{row.goal ?? '—'}</td>
                    <td className="py-2">
                      {row.scorePct != null ? (
                        <span className={row.scorePct >= 100 ? 'text-emerald-600 font-bold' : 'text-gray-700'}>
                          {row.scorePct}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rules.group_notifications?.enabled && view === 'score' && (
        <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Group alerts: admins configured goal tracking for{' '}
          {(rules.group_notifications.highlightPeriods || []).map((p) => PERIOD_LABELS[p]).join(', ') || 'this challenge'}.
        </div>
      )}

      {showShare && periodScore && canShare && (
        <ShareStatsModal
          contestId={contestId}
          contestName={contestName}
          userName={userDisplayName}
          metric={metric}
          periodLabel={PERIOD_LABELS[period]}
          achieved={periodScore.total}
          goal={periodScore.goal}
          scorePct={periodScore.scorePct ?? undefined}
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
