import { useState } from 'react';
import { X, AlertCircle, CheckCircle, Lock, Unlock, Calendar, Trash2, Edit2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChallengeIconPicker } from './ChallengeIconPicker';
import { uploadContestIcon, type IconPickerValue } from '../../lib/contestIcons';
import { parseContestDateToDatetimeLocal, smartDatetimeLocalUpdate } from '../../lib/dateUtils';
import {
  parseScoringRules,
  DEFAULT_GROUP_NOTIFICATIONS,
  PERIOD_LABELS,
  type ScoringRules,
  type StatsPeriod,
  type MetricGoals,
} from '../../lib/challengeGoals';

type Metric = {
  id: string;
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

type ContestSettingsModalProps = {
  contestId: string;
  contestName: string;
  contestDescription: string;
  contestIcon?: string;
  contestIconUrl?: string | null;
  currentStatus: string;
  isClosedForJoining: boolean;
  startDate: string;
  endDate: string;
  metrics: Metric[];
  scoringRules?: Record<string, unknown>;
  autoDeleteAt: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function ContestSettingsModal({
  contestId,
  contestName,
  contestDescription,
  contestIcon = 'target',
  contestIconUrl = null,
  currentStatus,
  isClosedForJoining,
  startDate,
  endDate,
  metrics,
  scoringRules: scoringRulesProp,
  autoDeleteAt,
  onClose,
  onSuccess,
}: ContestSettingsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [closed, setClosed] = useState(isClosedForJoining);
  const [autoDeleteDays, setAutoDeleteDays] = useState(30);
  const [enableAutoDelete, setEnableAutoDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState(contestName);
  const [editedDescription, setEditedDescription] = useState(contestDescription);
  const [editedStartDate, setEditedStartDate] = useState(() => parseContestDateToDatetimeLocal(startDate));
  const [editedEndDate, setEditedEndDate] = useState(() => parseContestDateToDatetimeLocal(endDate));
  const [editedMetrics, setEditedMetrics] = useState<Metric[]>(metrics);
  const [editedScoringRules, setEditedScoringRules] = useState<ScoringRules>(() =>
    parseScoringRules(scoringRulesProp)
  );
  const [editedIconPicker, setEditedIconPicker] = useState<IconPickerValue>({
    icon: contestIconUrl ? 'custom' : contestIcon || 'target',
    iconUrl: contestIconUrl,
    customFile: null,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const groupNotify = editedScoringRules.group_notifications ?? DEFAULT_GROUP_NOTIFICATIONS;

  const updateMetricGoal = (metricName: string, field: keyof MetricGoals, value: string) => {
    const num = value === '' ? undefined : Number(value);
    setEditedScoringRules((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [metricName]: {
          ...(prev.goals?.[metricName] ?? {}),
          [field]: num,
        },
      },
    }));
  };

  const handleDeleteContest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: detachError } = await supabase.rpc('detach_contest_from_templates', {
        p_contest_id: contestId,
      });
      if (
        detachError &&
        !detachError.message.includes('Could not find the function') &&
        !detachError.message.includes('schema cache')
      ) {
        console.warn('detach_contest_from_templates:', detachError);
      }

      const { error: deleteError } = await supabase
        .from('contests')
        .delete()
        .eq('id', contestId);

      if (deleteError) throw deleteError;

      setSuccess('Contest deleted successfully');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err: any) {
      const msg = err.message || 'Failed to delete contest';
      if (msg.includes('challenge_templates_source_contest_id_fkey')) {
        setError(
          'This challenge is linked to a published community template. Run the latest Supabase migration (20260609130000_contest_delete_template_fk.sql), then try again.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleClosedForJoining = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('contests')
        .update({ is_closed_for_joining: !closed })
        .eq('id', contestId);

      if (updateError) throw updateError;

      setClosed(!closed);
      setSuccess(!closed ? 'Contest closed for new joiners' : 'Contest opened for new joiners');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update contest');
    } finally {
      setLoading(false);
    }
  };

  const handleEndContest = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const updateData: any = {
        status: 'completed',
        ended_at: now,
      };

      if (enableAutoDelete) {
        const autoDelete = new Date();
        autoDelete.setDate(autoDelete.getDate() + autoDeleteDays);
        updateData.auto_delete_at = autoDelete.toISOString();
      }

      const { error: updateError } = await supabase
        .from('contests')
        .update(updateData)
        .eq('id', contestId);

      if (updateError) throw updateError;

      setSuccess('Contest ended successfully. Notifications sent to all participants.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to end contest');
    } finally {
      setLoading(false);
      setShowEndConfirm(false);
    }
  };

  const handleSetAutoDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const endDateObj = new Date(endDate);
      const autoDelete = new Date(endDateObj);
      autoDelete.setDate(autoDelete.getDate() + autoDeleteDays);

      const { error: updateError } = await supabase
        .from('contests')
        .update({ auto_delete_at: autoDelete.toISOString() })
        .eq('id', contestId);

      if (updateError) throw updateError;

      setSuccess(`Auto-delete scheduled for ${autoDeleteDays} days after contest end date`);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to set auto-delete');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdits = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) throw new Error('Not signed in');

      let icon = editedIconPicker.icon || 'target';
      let iconUrl: string | null = null;

      if (editedIconPicker.customFile) {
        iconUrl = await uploadContestIcon(user.id, editedIconPicker.customFile);
        icon = 'custom';
      } else if (editedIconPicker.icon === 'custom' && editedIconPicker.iconUrl) {
        icon = 'custom';
        iconUrl = editedIconPicker.iconUrl;
      }

      const metricsWithIds = editedMetrics.map((m, idx) => ({
        ...m,
        id: m.id || `metric_${idx}_${Date.now()}`,
        label: m.name,
      }));

      const { error: updateError } = await supabase
        .from('contests')
        .update({
          name: editedName,
          description: editedDescription,
          start_date: new Date(editedStartDate).toISOString(),
          end_date: new Date(editedEndDate).toISOString(),
          metrics: metricsWithIds,
          scoring_rules: editedScoringRules,
          icon,
          icon_url: iconUrl,
        })
        .eq('id', contestId);

      if (updateError) throw updateError;

      setSuccess('Contest updated successfully!');
      setEditMode(false);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update contest');
    } finally {
      setLoading(false);
    }
  };

  const addMetric = () => {
    setEditedMetrics([
      ...editedMetrics,
      { id: `new_${Date.now()}`, name: '', label: '', unit: '', type: 'number' },
    ]);
  };

  const updateMetric = (index: number, field: keyof Metric, value: string) => {
    const updated = [...editedMetrics];
    updated[index] = { ...updated[index], [field]: value };
    setEditedMetrics(updated);
  };

  const removeMetric = (index: number) => {
    setEditedMetrics(editedMetrics.filter((_, i) => i !== index));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Contest Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{contestName}</h3>
              {currentStatus !== 'completed' && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Details
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentStatus === 'active'
                    ? 'bg-green-100 text-green-800'
                    : currentStatus === 'completed'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {currentStatus}
              </span>
              <span>Ends: {formatDate(endDate)}</span>
            </div>
          </div>

          {editMode && (
            <div className="border border-emerald-200 rounded-lg p-6 bg-emerald-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Contest Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contest Name</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <ChallengeIconPicker
                  value={editedIconPicker}
                  onChange={setEditedIconPicker}
                  disabled={loading}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={editedStartDate}
                      onChange={(e) =>
                        setEditedStartDate(
                          smartDatetimeLocalUpdate(editedStartDate, e.target.value, 'start')
                        )
                      }
                      className="w-full min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Changing the day defaults to 12:00 am.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={editedEndDate}
                      onChange={(e) =>
                        setEditedEndDate(smartDatetimeLocalUpdate(editedEndDate, e.target.value, 'end'))
                      }
                      className="w-full min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Changing the day defaults to 11:59 pm.</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Metrics</label>
                    <button
                      type="button"
                      onClick={addMetric}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editedMetrics.map((metric, index) => (
                      <div key={metric.id || index} className="border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex gap-3 items-start mb-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={metric.name}
                              onChange={(e) => updateMetric(index, 'name', e.target.value)}
                              placeholder="Metric name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                          </div>
                          {editedMetrics.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMetric(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <select
                            value={metric.type || 'number'}
                            onChange={(e) => updateMetric(index, 'type', e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                          >
                            <option value="boolean">Yes/No</option>
                            <option value="number">Measurable</option>
                          </select>
                          {metric.type !== 'boolean' && (
                            <input
                              type="text"
                              value={metric.unit}
                              onChange={(e) => updateMetric(index, 'unit', e.target.value)}
                              placeholder="Unit"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                  <h4 className="font-semibold text-gray-900 mb-1">Goals & group score alerts</h4>
                  <p className="text-xs text-gray-600 mb-4">
                    <strong className="font-medium text-gray-800">Per-person targets</strong> for each metric. Score % =
                    logged amount ÷ this goal (shown in Stats &amp; Insights and share cards). In{' '}
                    <strong className="font-medium text-gray-800">group</strong> stats, everyone&apos;s logs are added
                    together and compared to (goal × number of members). Leave blank to skip a period.
                  </p>
                  {editedMetrics.map((metric) => {
                    const key = metric.name.toLowerCase().replace(/\s+/g, '_');
                    const g = editedScoringRules.goals?.[key] ?? editedScoringRules.goals?.[metric.name] ?? {};
                    const unitSuffix = metric.unit ? ` ${metric.unit}` : '';
                    return (
                      <div key={key} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-indigo-100">
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
                          setEditedScoringRules((prev) => ({
                            ...prev,
                            group_notifications: { ...groupNotify, enabled: e.target.checked },
                          }))
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
                          setEditedScoringRules((prev) => ({
                            ...prev,
                            group_notifications: { ...groupNotify, notifyOnGoalMiss: e.target.checked },
                          }))
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
                          setEditedScoringRules((prev) => ({
                            ...prev,
                            group_notifications: { ...groupNotify, notifyWeeklySummary: e.target.checked },
                          }))
                        }
                        className="rounded text-emerald-600"
                      />
                      Weekly summary in group stats
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveEdits}
                    disabled={loading || !editedName || !editedDescription || editedMetrics.length === 0}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditedName(contestName);
                      setEditedDescription(contestDescription);
                      setEditedStartDate(new Date(startDate).toISOString().slice(0, 16));
                      setEditedEndDate(new Date(endDate).toISOString().slice(0, 16));
                      setEditedMetrics(metrics);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {currentStatus !== 'completed' && (
            <>
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      {closed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      Joining Status
                    </h3>
                    <p className="text-sm text-gray-600">
                      {closed
                        ? 'New members cannot join this contest'
                        : 'New members can join this contest'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleClosedForJoining}
                  disabled={loading}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition ${
                    closed
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Processing...' : closed ? 'Open for New Joiners' : 'Close for New Joiners'}
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Auto-Delete Settings
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Automatically delete contest data after it ends
                </p>
                {autoDeleteAt && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      Scheduled for deletion: {formatDate(autoDeleteAt)}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={autoDeleteDays}
                    onChange={(e) => setAutoDeleteDays(parseInt(e.target.value) || 30)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-24"
                  />
                  <span className="text-sm text-gray-600">days after contest end date</span>
                </div>
                <button
                  onClick={handleSetAutoDelete}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Set Auto-Delete Schedule'}
                </button>
              </div>

              <div className="border border-red-200 rounded-lg p-6 bg-red-50">
                <h3 className="text-lg font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  End Contest
                </h3>
                <p className="text-sm text-red-800 mb-4">
                  This will mark the contest as completed and notify all participants. This action
                  cannot be undone.
                </p>

                <label className="flex items-center gap-2 mb-4 text-sm text-red-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAutoDelete}
                    onChange={(e) => setEnableAutoDelete(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="font-medium">Schedule auto-delete after ending</span>
                </label>

                {enableAutoDelete && (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={autoDeleteDays}
                        onChange={(e) => setAutoDeleteDays(parseInt(e.target.value) || 30)}
                        className="px-3 py-1 border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent w-20"
                      />
                      <span className="text-sm text-red-900">days after contest ends</span>
                    </div>
                    <p className="text-xs text-red-800">
                      All contest data including submissions, teams, and badges will be permanently deleted.
                    </p>
                  </div>
                )}

                {!showEndConfirm ? (
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                  >
                    End Contest Now
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-red-900">
                      Are you sure you want to end this contest?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleEndContest}
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Ending...' : 'Yes, End Contest'}
                      </button>
                      <button
                        onClick={() => setShowEndConfirm(false)}
                        className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {currentStatus === 'completed' && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Contest Completed</h3>
                <p className="text-sm text-gray-600">
                  This contest has ended.
                  {autoDeleteAt && (
                    <span className="block mt-2">
                      Data will be deleted on: {formatDate(autoDeleteAt)}
                    </span>
                  )}
                </p>
              </div>

              <div className="border border-red-200 rounded-lg p-6 bg-red-50">
                <h3 className="text-lg font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Delete Contest Permanently
                </h3>
                <p className="text-sm text-red-800 mb-4">
                  Permanently delete this contest and all associated data including submissions, participants, and history. This action cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                  >
                    Delete Contest
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-red-900">
                      Are you sure? This will permanently delete all contest data.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteContest}
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
