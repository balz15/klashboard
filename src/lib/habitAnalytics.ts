import { getLocalDateString, parseLocalDate } from './dateUtils';
import type { MetricGoals, StatsPeriod } from './challengeGoals';
import { getGoalForPeriod } from './challengeGoals';

export type SubmissionRow = {
  submission_date: string;
  metric_values: Record<string, unknown>;
  streak_count?: number;
};

export type MetricDef = {
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

export function metricNumericValue(metric: MetricDef, raw: unknown): number {
  if (metric.type === 'boolean') {
    return raw === true ? 1 : 0;
  }
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  return 0;
}

export function submissionMetricValue(sub: SubmissionRow, metric: MetricDef): number {
  const values = sub.metric_values ?? {};
  return metricNumericValue(metric, values[metric.name]);
}

export function computeBestStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseLocalDate(sorted[i - 1]);
    const cur = parseLocalDate(sorted[i]);
    const diff = (cur.getTime() - prev.getTime()) / (86400000);
    if (diff === 1) {
      run += 1;
      best = Math.max(best, run);
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

export function computeCurrentStreak(dates: string[], todayStr: string): number {
  const set = new Set(dates);
  if (!set.has(todayStr)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (!set.has(getLocalDateString(yesterday))) return 0;
  }
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (set.has(getLocalDateString(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export type CumulativePoint = {
  date: string;
  label: string;
  daily: number;
  cumulative: number;
};

export function buildCumulativeSeries(
  submissions: SubmissionRow[],
  metric: MetricDef,
  startDate: string,
  endDate: string
): CumulativePoint[] {
  const start = parseLocalDate(startDate.slice(0, 10));
  const end = parseLocalDate(endDate.slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = end < today ? end : today;

  const byDate = new Map<string, number>();
  submissions.forEach((s) => {
    byDate.set(s.submission_date, submissionMetricValue(s, metric));
  });

  const out: CumulativePoint[] = [];
  let cumulative = 0;
  const cur = new Date(start);
  while (cur <= rangeEnd) {
    const dateStr = getLocalDateString(cur);
    const daily = byDate.get(dateStr) ?? 0;
    cumulative += daily;
    out.push({
      date: dateStr,
      label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daily,
      cumulative,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function periodKey(dateStr: string, period: StatsPeriod): string {
  const d = parseLocalDate(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (period) {
    case 'daily':
      return dateStr;
    case 'weekly': {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      return getLocalDateString(monday);
    }
    case 'monthly':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'quarterly':
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'yearly':
      return String(y);
  }
}

function periodLabel(key: string, period: StatsPeriod): string {
  if (period === 'daily') {
    return parseLocalDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (period === 'weekly') {
    const start = parseLocalDate(key);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (period === 'monthly') {
    const [y, mo] = key.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return key;
}

export type PeriodBucket = {
  key: string;
  label: string;
  total: number;
  entries: number;
  goal?: number;
  scorePct: number | null;
};

export function buildPeriodHistory(
  submissions: SubmissionRow[],
  metric: MetricDef,
  period: StatsPeriod,
  goals: MetricGoals
): PeriodBucket[] {
  const buckets = new Map<string, { total: number; entries: number }>();

  submissions.forEach((s) => {
    const v = submissionMetricValue(s, metric);
    const key = periodKey(s.submission_date, period);
    const prev = buckets.get(key) ?? { total: 0, entries: 0 };
    prev.total += v;
    prev.entries += 1;
    buckets.set(key, prev);
  });

  const goal = getGoalForPeriod(goals, period);

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { total, entries }]) => ({
      key,
      label: periodLabel(key, period),
      total: Math.round(total * 100) / 100,
      entries,
      goal,
      scorePct:
        goal != null && goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : null,
    }));
}

export type CalendarDay = {
  date: string;
  inRange: boolean;
  inFuture: boolean;
  hasEntry: boolean;
  value: number;
};

export function buildCalendarMonth(
  year: number,
  month: number,
  submissions: SubmissionRow[],
  metric: MetricDef,
  startDate: string,
  endDate: string
): CalendarDay[] {
  const todayStr = getLocalDateString(new Date());
  const start = parseLocalDate(startDate.slice(0, 10));
  const end = parseLocalDate(endDate.slice(0, 10));
  const byDate = new Map<string, SubmissionRow>();
  submissions.forEach((s) => byDate.set(s.submission_date, s));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = parseLocalDate(dateStr);
    const sub = byDate.get(dateStr);
    out.push({
      date: dateStr,
      inRange: date >= start && date <= end,
      inFuture: dateStr > todayStr,
      hasEntry: !!sub,
      value: sub ? submissionMetricValue(sub, metric) : 0,
    });
  }
  return out;
}

export function currentPeriodTotals(
  submissions: SubmissionRow[],
  metric: MetricDef,
  period: StatsPeriod,
  goals: MetricGoals,
  referenceDate = new Date()
): { total: number; goal?: number; scorePct: number | null; label: string } {
  const refStr = getLocalDateString(referenceDate);
  const key = periodKey(refStr, period);
  const filtered = submissions.filter((s) => periodKey(s.submission_date, period) === key);
  const total = filtered.reduce((sum, s) => sum + submissionMetricValue(s, metric), 0);
  const goal = getGoalForPeriod(goals, period);
  return {
    total: Math.round(total * 100) / 100,
    goal,
    scorePct: goal != null && goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : null,
    label: periodLabel(key, period),
  };
}

export type SubmissionWithParticipant = SubmissionRow & { participant_id: string };

/** Sum metric values across all participants per day (group totals). */
export function aggregateGroupSubmissions(
  allSubmissions: SubmissionWithParticipant[],
  metric: MetricDef
): SubmissionRow[] {
  const byDate = new Map<string, number>();
  allSubmissions.forEach((s) => {
    const v = submissionMetricValue(s, metric);
    byDate.set(s.submission_date, (byDate.get(s.submission_date) ?? 0) + v);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([submission_date, value]) => ({
      submission_date,
      metric_values: { [metric.name]: value },
    }));
}

/** Consecutive days (ending today or yesterday) where every participant logged. */
export function computeGroupPerfectStreak(
  allSubmissions: SubmissionWithParticipant[],
  participantIds: string[],
  todayStr: string
): number {
  if (participantIds.length === 0) return 0;
  const byDate = new Map<string, Set<string>>();
  allSubmissions.forEach((s) => {
    if (!byDate.has(s.submission_date)) byDate.set(s.submission_date, new Set());
    byDate.get(s.submission_date)!.add(s.participant_id);
  });

  const allLogged = (dateStr: string) => {
    const set = byDate.get(dateStr);
    return !!set && participantIds.every((id) => set.has(id));
  };

  if (!allLogged(todayStr)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (!allLogged(getLocalDateString(yesterday))) return 0;
  }

  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (allLogged(getLocalDateString(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive days where every participant logged. */
export function computeBestGroupPerfectStreak(
  allSubmissions: SubmissionWithParticipant[],
  participantIds: string[]
): number {
  if (participantIds.length === 0) return 0;
  const byDate = new Map<string, Set<string>>();
  allSubmissions.forEach((s) => {
    if (!byDate.has(s.submission_date)) byDate.set(s.submission_date, new Set());
    byDate.get(s.submission_date)!.add(s.participant_id);
  });
  const perfectDates = [...byDate.entries()]
    .filter(([, set]) => participantIds.every((id) => set.has(id)))
    .map(([date]) => date);
  return computeBestStreakFromDates(perfectDates);
}

export function scaleGoalsForGroup(goals: MetricGoals, participantCount: number): MetricGoals {
  if (participantCount <= 1) return goals;
  const scaled: MetricGoals = {};
  (['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as StatsPeriod[]).forEach((p) => {
    if (goals[p] != null) scaled[p] = goals[p]! * participantCount;
  });
  return scaled;
}
