import { supabase } from './supabase';
import { getTodayString, getYesterdayString } from './dateUtils';
import { refreshRemindersAfterLogging } from './engagementReminders';

export async function submitDailyEntry(params: {
  contestId: string;
  participantId: string;
  metricValues: Record<string, unknown>;
  notes?: string | null;
}): Promise<{ error: Error | null }> {
  const { contestId, participantId, metricValues, notes = null } = params;
  const submissionDate = getTodayString();

  try {
    const { data: existingSubmission, error: findError } = await supabase
      .from('submissions')
      .select('id')
      .eq('contest_id', contestId)
      .eq('participant_id', participantId)
      .eq('submission_date', submissionDate)
      .maybeSingle();

    if (findError) throw findError;

    if (existingSubmission) {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          metric_values: metricValues,
          notes,
        })
        .eq('id', existingSubmission.id);
      if (updateError) throw updateError;
      void refreshRemindersAfterLogging();
      return { error: null };
    }

    const { data: previousSubmission, error: prevError } = await supabase
      .from('submissions')
      .select('submission_date, streak_count')
      .eq('contest_id', contestId)
      .eq('participant_id', participantId)
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevError) throw prevError;

    let streakCount = 1;
    if (previousSubmission) {
      const yesterdayStr = getYesterdayString();
      if (previousSubmission.submission_date === yesterdayStr) {
        streakCount = (previousSubmission.streak_count || 0) + 1;
      }
    }

    const { error: insertError } = await supabase.from('submissions').insert({
      contest_id: contestId,
      participant_id: participantId,
      submission_date: submissionDate,
      metric_values: metricValues,
      notes,
      streak_count: streakCount,
    });

    if (insertError) throw insertError;
    void refreshRemindersAfterLogging();
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to save entry'),
    };
  }
}
