import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { contestId } = await req.json();

    if (!contestId) {
      return new Response(
        JSON.stringify({ error: 'contestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contest details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('start_date, group_streak_count, last_group_streak_date')
      .eq('id', contestId)
      .single();

    if (contestError) throw contestError;

    // Get all active participants
    const { data: participants, error: participantsError } = await supabase
      .from('contest_participants')
      .select('id')
      .eq('contest_id', contestId)
      .is('left_at', null);

    if (participantsError) throw participantsError;

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ groupStreak: 0, message: 'No active participants' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('participant_id, submission_date')
      .eq('contest_id', contestId)
      .order('submission_date', { ascending: true });

    if (submissionsError) throw submissionsError;

    const startDate = new Date(contest.start_date);
    const today = new Date();
    const todayStr = getLocalDateString(today);

    let groupStreak = 0;
    let lastStreakDate: string | null = null;
    let currentDate = new Date(startDate);

    // Track missed days for each participant
    const participantMissedDays = new Map<string, number>();
    participants.forEach(p => participantMissedDays.set(p.id, 0));

    // Iterate through each day from start to today
    while (getLocalDateString(currentDate) <= todayStr) {
      const dateStr = getLocalDateString(currentDate);
      
      // Get submissions for this date
      const dateSubmissions = submissions?.filter(s => s.submission_date === dateStr) || [];
      const submittedParticipantIds = new Set(dateSubmissions.map(s => s.participant_id));

      // Check if all active participants submitted
      const allSubmitted = participants.every(p => submittedParticipantIds.has(p.id));

      if (allSubmitted) {
        // Everyone submitted - increase streak
        groupStreak++;
        lastStreakDate = dateStr;
        
        // Reset everyone's missed days counter
        participants.forEach(p => participantMissedDays.set(p.id, 0));
      } else {
        // Someone missed - increment their missed days counter
        participants.forEach(p => {
          if (!submittedParticipantIds.has(p.id)) {
            const currentMissed = participantMissedDays.get(p.id) || 0;
            participantMissedDays.set(p.id, currentMissed + 1);
          }
        });

        // Check if anyone has missed more than 2 consecutive days
        const someoneExceededLimit = Array.from(participantMissedDays.values()).some(missed => missed > 2);
        
        if (someoneExceededLimit) {
          // Reset the group streak
          groupStreak = 0;
          lastStreakDate = null;
          // Reset missed days counters
          participants.forEach(p => participantMissedDays.set(p.id, 0));
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Update the contest with the new group streak
    const { error: updateError } = await supabase
      .from('contests')
      .update({
        group_streak_count: groupStreak,
        last_group_streak_date: lastStreakDate,
      })
      .eq('id', contestId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        groupStreak,
        lastStreakDate,
        message: 'Group streak updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating group streak:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});