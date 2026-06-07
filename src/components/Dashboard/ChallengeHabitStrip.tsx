import { useState, useEffect } from 'react';
import { Calendar, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getLocalDateString, parseLocalDate } from '../../lib/dateUtils';

type Props = {
  contestId: string;
  participantId?: string;
  startDate: string;
  endDate: string;
};

function eachDayInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    out.push(getLocalDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function ChallengeHabitStrip({ contestId, participantId, startDate, endDate }: Props) {
  const [streak, setStreak] = useState<number | null>(null);
  const [weekDone, setWeekDone] = useState(0);
  const [weekTotal, setWeekTotal] = useState(7);
  const [dots, setDots] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!participantId) {
      setLoading(false);
      setStreak(null);
      setDots([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('submissions')
          .select('submission_date, streak_count')
          .eq('contest_id', contestId)
          .eq('participant_id', participantId)
          .order('submission_date', { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const dates = new Set((data || []).map((r) => r.submission_date));
        const latest = data && data.length > 0 ? data[data.length - 1] : null;
        setStreak(latest?.streak_count ?? 0);

        const start = parseLocalDate(startDate.slice(0, 10));
        const end = parseLocalDate(endDate.slice(0, 10));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rangeEnd = end < today ? end : today;
        const allDays = eachDayInRange(start, rangeEnd);

        const last7 = allDays.slice(-7);
        setWeekTotal(last7.length || 1);
        setWeekDone(last7.filter((d) => dates.has(d)).length);
        setDots(last7.map((d) => dates.has(d)));
      } catch (e) {
        console.error('ChallengeHabitStrip:', e);
        if (!cancelled) {
          setStreak(null);
          setDots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contestId, participantId, startDate, endDate]);

  if (!participantId) return null;

  if (loading) {
    return (
      <div className="mt-3 h-10 flex items-center">
        <div className="h-2 w-full bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1 font-medium text-orange-700">
          <Flame className="w-3.5 h-3.5" />
          Streak {streak ?? 0}d
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          This week {weekDone}/{weekTotal} days
        </span>
      </div>
      <div className="flex gap-1.5" title="Last days in challenge (filled = logged)">
        {dots.map((on, i) => (
          <div
            key={i}
            className={`h-2 flex-1 min-w-[6px] max-w-8 rounded-full ${
              on ? 'bg-emerald-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
