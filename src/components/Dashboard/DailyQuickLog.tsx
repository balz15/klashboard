import { useState, useCallback } from 'react';
import { CheckCircle, ClipboardList, Loader2, ChevronDown } from 'lucide-react';
import { submitDailyEntry } from '../../lib/submitDailyEntry';

type Metric = {
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

export type QuickLogChallenge = {
  id: string;
  name: string;
  participantId: string;
  metrics: Metric[];
};

type DailyQuickLogProps = {
  challenges: QuickLogChallenge[];
  onSuccess: () => void;
};

function normalizeMetrics(raw: unknown): Metric[] {
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

export function DailyQuickLog({ challenges, onSuccess }: DailyQuickLogProps) {
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const pending = challenges.filter((c) => !savedIds.has(c.id));

  const showError = useCallback((message: string) => {
    setError(message);
    setExpanded(true);
  }, []);

  const updateValue = (contestId: string, metricName: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [contestId]: { ...(prev[contestId] ?? {}), [metricName]: value },
    }));
  };

  const hasValuesForChallenge = (contestId: string) => {
    const row = values[contestId];
    return !!row && Object.keys(row).length > 0;
  };

  const handleSaveAll = async () => {
    const toSubmit = pending.filter((c) => hasValuesForChallenge(c.id));
    if (toSubmit.length === 0) {
      showError('Fill in at least one metric for a challenge.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const newSaved = new Set(savedIds);
    const failures: string[] = [];

    for (const challenge of toSubmit) {
      const metricValues = values[challenge.id] ?? {};
      const { error: submitError } = await submitDailyEntry({
        contestId: challenge.id,
        participantId: challenge.participantId,
        metricValues,
      });
      if (submitError) {
        failures.push(challenge.name);
      } else {
        newSaved.add(challenge.id);
      }
    }

    setSavedIds(newSaved);
    setSubmitting(false);

    if (failures.length > 0) {
      showError(`Could not save: ${failures.join(', ')}`);
    }

    if (newSaved.size > savedIds.size) {
      onSuccess();
    }
  };

  if (challenges.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-900">All caught up for today</p>
          <p className="text-sm text-emerald-700">No pending entries across your active challenges.</p>
        </div>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-900">Today&apos;s entries saved</p>
          <p className="text-sm text-emerald-700">Great work — you&apos;re up to date on all challenges.</p>
        </div>
      </div>
    );
  }

  const pendingLabel = `${pending.length} challenge${pending.length !== 1 ? 's' : ''} waiting for today's entry`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className={`w-full text-left bg-gradient-to-r from-emerald-600 to-teal-600 text-white ${
          expanded ? 'p-4 border-b border-emerald-500/30' : 'p-3'
        }`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/15 rounded-lg shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Log today&apos;s progress</h2>
            <p className="text-xs text-emerald-50 mt-0.5">{pendingLabel}</p>
          </div>
          <ChevronDown
            className={`w-5 h-5 shrink-0 text-emerald-50 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
      <div className="p-4 space-y-5">
        {pending.map((challenge) => {
          const metrics = normalizeMetrics(challenge.metrics);
          return (
            <div
              key={challenge.id}
              className="border border-gray-200 rounded-xl p-4 bg-gray-50/80"
            >
              <h3 className="font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                {challenge.name}
              </h3>
              <div className="space-y-3">
                {metrics.map((metric) => (
                  <div key={metric.name} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 sm:w-36 shrink-0">
                      {metric.label}
                      {metric.type === 'number' && metric.unit ? ` (${metric.unit})` : ''}
                    </label>
                    {metric.type === 'boolean' ? (
                      <div className="flex gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => updateValue(challenge.id, metric.name, true)}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${
                            values[challenge.id]?.[metric.name] === true
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => updateValue(challenge.id, metric.name, false)}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${
                            values[challenge.id]?.[metric.name] === false
                              ? 'bg-red-50 border-red-400 text-red-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Missed
                        </button>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={(values[challenge.id]?.[metric.name] as number | undefined) ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setValues((prev) => {
                              const row = { ...(prev[challenge.id] ?? {}) };
                              delete row[metric.name];
                              return { ...prev, [challenge.id]: row };
                            });
                          } else {
                            updateValue(challenge.id, metric.name, parseFloat(v));
                          }
                        }}
                        placeholder={`Enter ${metric.label.toLowerCase()}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={submitting || !pending.some((c) => hasValuesForChallenge(c.id))}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save all entries'
          )}
        </button>
      </div>
      )}
    </div>
  );
}
