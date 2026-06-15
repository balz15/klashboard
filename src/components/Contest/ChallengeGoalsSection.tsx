import {
  DEFAULT_GROUP_NOTIFICATIONS,
  PERIOD_LABELS,
  type MetricGoals,
  type ScoringRules,
  type StatsPeriod,
} from '../../lib/challengeGoals';

export type GoalMetric = {
  name: string;
  label?: string;
  unit: string;
  type: 'boolean' | 'number';
};

type ChallengeGoalsSectionProps = {
  metrics: GoalMetric[];
  scoringRules: ScoringRules;
  onChange: (rules: ScoringRules) => void;
};

export function ChallengeGoalsSection({ metrics, scoringRules, onChange }: ChallengeGoalsSectionProps) {
  const groupNotify = scoringRules.group_notifications ?? DEFAULT_GROUP_NOTIFICATIONS;

  const updateMetricGoal = (metricName: string, field: keyof MetricGoals, value: string) => {
    const num = value === '' ? undefined : Number(value);
    onChange({
      ...scoringRules,
      goals: {
        ...scoringRules.goals,
        [metricName]: {
          ...(scoringRules.goals?.[metricName] ?? {}),
          [field]: num,
        },
      },
    });
  };

  if (metrics.length === 0 || !metrics.some((m) => m.name.trim())) {
    return null;
  }

  return (
    <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
      <h4 className="font-semibold text-gray-900 mb-1">Goals & group score alerts</h4>
      <p className="text-xs text-gray-600 mb-4">
        <strong className="font-medium text-gray-800">Per-person targets</strong> for each metric. Score % = logged
        amount ÷ this goal (shown in Stats &amp; Insights and share cards). In{' '}
        <strong className="font-medium text-gray-800">group</strong> stats, everyone&apos;s logs are added together and
        compared to (goal × number of members). Leave blank to skip a period.
      </p>
      {metrics.map((metric) => {
        const key = metric.name.toLowerCase().replace(/\s+/g, '_');
        if (!key) return null;
        const g = scoringRules.goals?.[key] ?? scoringRules.goals?.[metric.name] ?? {};
        const unitSuffix = metric.unit ? ` ${metric.unit}` : '';
        return (
          <div
            key={key}
            className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-indigo-100"
          >
            <p className="text-sm font-medium text-gray-800">{metric.label || metric.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              {metric.type === 'boolean'
                ? 'Yes/No: 1 daily = each person completes once today. Weekly 7 = seven successful days per person in the week.'
                : `Example: Daily 5000 = each member aims for 5,000${unitSuffix} per day. Group view compares the sum of all members to 5,000 × group size.`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as StatsPeriod[]).map((p) => (
                <div key={p}>
                  <label className="text-xs text-gray-500">{PERIOD_LABELS[p]}</label>
                  <input
                    type="number"
                    min={0}
                    step={metric.type === 'boolean' ? 1 : 0.1}
                    value={g[p] ?? ''}
                    onChange={(e) => updateMetricGoal(key, p, e.target.value)}
                    placeholder={metric.type === 'boolean' ? (p === 'daily' ? '1' : '7') : '—'}
                    className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={groupNotify.enabled}
            onChange={(e) =>
              onChange({
                ...scoringRules,
                group_notifications: { ...groupNotify, enabled: e.target.checked },
              })
            }
            className="rounded text-emerald-600"
          />
          Show goal scores in group Stats &amp; Insights
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={groupNotify.notifyOnGoalMiss}
            onChange={(e) =>
              onChange({
                ...scoringRules,
                group_notifications: { ...groupNotify, notifyOnGoalMiss: e.target.checked },
              })
            }
            className="rounded text-emerald-600"
          />
          Flag members who miss their period target
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={groupNotify.notifyWeeklySummary}
            onChange={(e) =>
              onChange({
                ...scoringRules,
                group_notifications: { ...groupNotify, notifyWeeklySummary: e.target.checked },
              })
            }
            className="rounded text-emerald-600"
          />
          Weekly summary in group stats
        </label>
      </div>
    </div>
  );
}
