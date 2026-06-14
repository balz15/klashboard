export type StatsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type MetricGoals = {
  daily?: number;
  weekly?: number;
  monthly?: number;
  quarterly?: number;
  yearly?: number;
};

export type GroupNotificationConfig = {
  enabled: boolean;
  notifyOnGoalMiss: boolean;
  notifyOnStreakMilestone: boolean;
  notifyWeeklySummary: boolean;
  highlightPeriods: StatsPeriod[];
};

export type ScoringRules = {
  goals?: Record<string, MetricGoals>;
  group_notifications?: GroupNotificationConfig;
};

export const DEFAULT_GROUP_NOTIFICATIONS: GroupNotificationConfig = {
  enabled: true,
  notifyOnGoalMiss: true,
  notifyOnStreakMilestone: true,
  notifyWeeklySummary: true,
  highlightPeriods: ['daily', 'weekly', 'monthly'],
};

export function parseScoringRules(raw: Record<string, unknown> | null | undefined): ScoringRules {
  if (!raw || typeof raw !== 'object') return {};
  return raw as ScoringRules;
}

export function getMetricGoals(rules: ScoringRules, metricName: string): MetricGoals {
  return rules.goals?.[metricName] ?? {};
}

export function getGoalForPeriod(goals: MetricGoals, period: StatsPeriod): number | undefined {
  return goals[period];
}

/** Default goal for yes/no habits: 1 per day, 7 per week, etc. */
export function defaultGoalsForMetric(type: 'boolean' | 'number'): MetricGoals {
  if (type === 'boolean') {
    return { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };
  }
  return {};
}

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};
