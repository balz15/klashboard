import { useState } from 'react';
import { CheckCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString, getYesterdayString } from '../../lib/dateUtils';

type Metric = {
  id: string;
  name: string;
  label: string;
  unit: string;
  type: 'boolean' | 'number';
};

type QuickCheckInProps = {
  contestId: string;
  participantId: string;
  metrics: Metric[];
  onSuccess: () => void;
};

export function QuickCheckIn({ contestId, participantId, metrics, onSuccess }: QuickCheckInProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const booleanMetrics = metrics.filter((m) => m.type === 'boolean');

  if (booleanMetrics.length === 0) {
    return null;
  }

  const handleQuickSubmit = async () => {
    setSubmitting(true);
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
        return;
      }

      const metricValues: Record<string, boolean> = {};
      booleanMetrics.forEach((metric) => {
        metricValues[metric.name] = true;
      });

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
        notes: null,
        streak_count: streakCount,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error('Quick check-in error:', error);
      alert('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-emerald-100 border-2 border-emerald-500 rounded-xl p-6 animate-pulse">
        <div className="flex items-center justify-center gap-2 text-emerald-700">
          <CheckCircle className="w-8 h-8" />
          <span className="text-xl font-bold">Done for today!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6" />
            Quick Check-In
          </h3>
          <p className="text-blue-100 text-sm">
            Tap to mark all as done for today
          </p>
        </div>
        <button
          onClick={handleQuickSubmit}
          disabled={submitting}
          className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg"
        >
          {submitting ? 'Logging...' : "I'm Done!"}
        </button>
      </div>
    </div>
  );
}
