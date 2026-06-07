import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, ChallengeTemplate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  dateAtEndOfDayLocal,
  dateAtStartOfDayLocal,
  smartDatetimeLocalUpdate,
} from '../../lib/dateUtils';

type Metric = {
  name: string;
  unit: string;
  type: 'boolean' | 'number';
};

type ContestWizardProps = {
  template?: ChallengeTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function ContestWizard({ template, onClose, onSuccess }: ContestWizardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() + 1);
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + (template?.suggested_duration_days || 30));
  const tomorrowStr = dateAtStartOfDayLocal(defaultStart);
  const defaultEndStr = dateAtEndOfDayLocal(defaultEnd);

  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    startDate: tomorrowStr,
    endDate: defaultEndStr,
    metrics: (template?.default_metrics || []) as Metric[],
  });

  useEffect(() => {
    if (template) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = dateAtStartOfDayLocal(tomorrow);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (template.suggested_duration_days || 30));
      const endStr = dateAtEndOfDayLocal(endDate);

      setFormData({
        name: template.name,
        description: template.description,
        startDate: tomorrowStr,
        endDate: endStr,
        metrics: (template.default_metrics || []) as Metric[],
      });
    }
  }, [template]);

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const updateMetric = (field: keyof Metric, value: string) => {
    const metric = formData.metrics[0] || { name: '', unit: '', type: 'number' };
    updateField('metrics', [{ ...metric, [field]: value }]);
  };

  const generateUniqueCode = async (): Promise<string> => {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data } = await supabase
        .from('contests')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle();

      if (!data) {
        return code;
      }
    }

    throw new Error('Failed to generate unique invite code. Please try again.');
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('No user found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const inviteCode = await generateUniqueCode();

      const metricsForDB = formData.metrics.map((m, i) => ({
        id: `metric-${i}`,
        name: m.name.toLowerCase().replace(/\s+/g, '_'),
        label: m.name,
        unit: m.unit,
        type: 'number' as const,
      }));

      const { data, error: insertError } = await supabase
        .from('contests')
        .insert({
          creator_id: user.id,
          name: formData.name,
          description: formData.description,
          start_date: formData.startDate,
          end_date: formData.endDate,
          visibility: 'private',
          status: 'active',
          metrics: metricsForDB,
          scoring_rules: {},
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Challenge insert error:', insertError);
        throw insertError;
      }

      await supabase.from('contest_participants').insert({
        contest_id: data.id,
        user_id: user.id,
        role: 'admin',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    const metric = formData.metrics[0];
    return (
      formData.name &&
      formData.description &&
      formData.startDate &&
      formData.endDate &&
      metric &&
      metric.name &&
      (metric.type === 'boolean' || metric.unit)
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Challenge</h2>
            <p className="text-sm text-gray-600 mt-1">
              {template && template.category !== 'custom' ? `Using ${template.name} template` : 'Custom challenge'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challenge Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., 30-Day Step Challenge"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your challenge and goals"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start date &amp; time
                </label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) =>
                    updateField(
                      'startDate',
                      smartDatetimeLocalUpdate(formData.startDate, e.target.value, 'start')
                    )
                  }
                  className="w-full min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">New day defaults to 12:00 am start.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End date &amp; time
                </label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) =>
                    updateField(
                      'endDate',
                      smartDatetimeLocalUpdate(formData.endDate, e.target.value, 'end')
                    )
                  }
                  className="w-full min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">New day defaults to 11:59 pm end.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What to Track
              </label>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="mb-3">
                  <input
                    type="text"
                    value={formData.metrics[0]?.name || ''}
                    onChange={(e) => updateMetric('name', e.target.value)}
                    placeholder="e.g., Daily Workout, Reading, Steps"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    value={formData.metrics[0]?.type || 'number'}
                    onChange={(e) => updateMetric('type', e.target.value as 'boolean' | 'number')}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="boolean">Yes/No</option>
                    <option value="number">Number</option>
                  </select>
                  {formData.metrics[0]?.type !== 'boolean' && (
                    <input
                      type="text"
                      value={formData.metrics[0]?.unit || ''}
                      onChange={(e) => updateMetric('unit', e.target.value)}
                      placeholder="Unit (e.g., steps, pages, minutes)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Choose "Yes/No" for simple daily completion (Did you do it?), or "Number" to track quantities (How many?).
              </p>
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
            disabled={!canSubmit() || loading}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}
