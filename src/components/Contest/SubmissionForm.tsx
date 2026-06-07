import { useState } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString, getYesterdayString } from '../../lib/dateUtils';

type Metric = {
  id: string;
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

type SubmissionFormProps = {
  contestId: string;
  participantId: string;
  metrics: Metric[];
  onClose: () => void;
  onSuccess: () => void;
};

export function SubmissionForm({
  contestId,
  participantId,
  metrics,
  onClose,
  onSuccess,
}: SubmissionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [metricValues, setMetricValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  const updateMetricValue = (metricName: string, value: string | boolean) => {
    if (typeof value === 'boolean') {
      setMetricValues({ ...metricValues, [metricName]: value });
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setMetricValues({ ...metricValues, [metricName]: numValue });
      } else {
        const updated = { ...metricValues };
        delete updated[metricName];
        setMetricValues(updated);
      }
    }
  };

  const handleSubmit = async () => {
    const metricEntries = Object.entries(metricValues);
    if (metricEntries.length === 0) {
      setError('Please enter at least one metric value');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const submissionDate = getTodayString();

      const { data: existingSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('contest_id', contestId)
        .eq('participant_id', participantId)
        .eq('submission_date', submissionDate)
        .maybeSingle();

      if (existingSubmission) {
        await supabase
          .from('submissions')
          .update({
            metric_values: metricValues,
            notes: notes || null,
          })
          .eq('id', existingSubmission.id);
      } else {
        const { data: previousSubmission } = await supabase
          .from('submissions')
          .select('submission_date, streak_count')
          .eq('contest_id', contestId)
          .eq('participant_id', participantId)
          .order('submission_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        let streakCount = 1;
        if (previousSubmission) {
          const yesterdayStr = getYesterdayString();

          if (previousSubmission.submission_date === yesterdayStr) {
            streakCount = (previousSubmission.streak_count || 0) + 1;
          }
        }

        await supabase.from('submissions').insert({
          contest_id: contestId,
          participant_id: participantId,
          submission_date: submissionDate,
          metric_values: metricValues,
          notes: notes || null,
          streak_count: streakCount,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Submitted!</h3>
          <p className="text-gray-600">Your progress has been logged</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Log Today's Progress</h2>
            <p className="text-sm text-gray-600 mt-1">Enter your metrics for today</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {metric.label}
                  {metric.type === 'number' && metric.unit && ` (${metric.unit})`}
                </label>
                {metric.type === 'boolean' ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => updateMetricValue(metric.name, true)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition font-medium ${
                        metricValues[metric.name] === true
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                      Yes / Done
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMetricValue(metric.name, false)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition font-medium ${
                        metricValues[metric.name] === false
                          ? 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <XCircle className="w-5 h-5 mx-auto mb-1" />
                      No / Missed
                    </button>
                  </div>
                ) : (
                  <input
                    type="number"
                    step="any"
                    value={metricValues[metric.name] ?? ''}
                    onChange={(e) => updateMetricValue(metric.name, e.target.value)}
                    placeholder={`Enter ${metric.label.toLowerCase()}`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did it go? Any reflections?"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(metricValues).length === 0}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
