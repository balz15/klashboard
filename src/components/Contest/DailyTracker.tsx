import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../lib/dateUtils';
import { refreshRemindersAfterLogging } from '../../lib/engagementReminders';

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
  notes: string | null;
  streak_count: number;
};

type DailyTrackerProps = {
  contestId: string;
  participantId: string;
  metrics: Metric[];
  startDate: string;
  endDate: string;
  onSubmissionUpdate: () => void;
};

export function DailyTracker({
  contestId,
  participantId,
  metrics,
  startDate,
  endDate,
  onSubmissionUpdate,
}: DailyTrackerProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [metricValues, setMetricValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, [contestId, participantId]);

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .eq('participant_id', participantId)
        .order('submission_date', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getSubmissionForDate = (dateStr: string) => {
    return submissions.find((s) => s.submission_date === dateStr);
  };

  const isDateInRange = (dateStr: string) => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const date = new Date(dateStr + 'T00:00:00');
    return date >= start && date <= end;
  };

  const isDateInFuture = (dateStr: string) => {
    const todayStr = getLocalDateString(new Date());
    return dateStr > todayStr;
  };

  const handleEditDate = (dateStr: string) => {
    const submission = getSubmissionForDate(dateStr);
    setEditingDate(dateStr);
    setMetricValues(submission?.metric_values || {});
    setNotes(submission?.notes || '');
  };

  const handleSaveSubmission = async () => {
    if (!editingDate) return;

    setSubmitting(true);
    try {
      const existingSubmission = getSubmissionForDate(editingDate);

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
          .lt('submission_date', editingDate)
          .order('submission_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        let streakCount = 1;
        if (previousSubmission) {
          const prevDate = new Date(previousSubmission.submission_date);
          const currentDate = new Date(editingDate);
          const dayDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            streakCount = (previousSubmission.streak_count || 0) + 1;
          }
        }

        await supabase.from('submissions').insert({
          contest_id: contestId,
          participant_id: participantId,
          submission_date: editingDate,
          metric_values: metricValues,
          notes: notes || null,
          streak_count: streakCount,
        });
      }

      await loadSubmissions();
      if (editingDate === getLocalDateString(new Date())) {
        void refreshRemindersAfterLogging();
      }
      setEditingDate(null);
      setMetricValues({});
      setNotes('');
      onSubmissionUpdate();
    } catch (error) {
      console.error('Error saving submission:', error);
      alert('Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const submission = getSubmissionForDate(dateStr);
      const inRange = isDateInRange(dateStr);
      const inFuture = isDateInFuture(dateStr);
      const hasData = !!submission;
      const isToday = dateStr === getLocalDateString(new Date());

      let dayClass = 'aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition ';

      if (!inRange) {
        dayClass += 'bg-gray-100 text-gray-400 cursor-not-allowed';
      } else if (inFuture) {
        dayClass += 'bg-gray-50 text-gray-400 cursor-not-allowed';
      } else if (hasData) {
        dayClass += 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
      } else if (isToday) {
        dayClass += 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-2 border-blue-500';
      } else {
        dayClass += 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50';
      }

      days.push(
        <div
          key={day}
          className={dayClass}
          onClick={() => {
            if (inRange && !inFuture) {
              handleEditDate(dateStr);
            }
          }}
        >
          <span className="text-sm font-medium">{day}</span>
          {hasData && <CheckCircle className="w-4 h-4 mt-1" />}
          {inRange && !inFuture && !hasData && <XCircle className="w-4 h-4 mt-1 text-gray-300" />}
        </div>
      );
    }

    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Daily Tracker
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-100 rounded"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
          <span>Not logged</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
          <span>Today</span>
        </div>
      </div>

      {editingDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Log Entry
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(editingDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setEditingDate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <XCircle className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {metrics.map((metric) => (
                <div key={metric.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {metric.label}
                  </label>
                  {metric.type === 'boolean' ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setMetricValues({ ...metricValues, [metric.name]: true })}
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
                        onClick={() => setMetricValues({ ...metricValues, [metric.name]: false })}
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
                      onChange={(e) => {
                        const value = e.target.value;
                        setMetricValues({
                          ...metricValues,
                          [metric.name]: value === '' ? undefined : parseFloat(value),
                        });
                      }}
                      placeholder={`Enter ${metric.label.toLowerCase()}`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  )}
                  {metric.type === 'number' && metric.unit && (
                    <p className="text-xs text-gray-500 mt-1">Unit: {metric.unit}</p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setEditingDate(null)}
                className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubmission}
                disabled={submitting || Object.keys(metricValues).length === 0}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
