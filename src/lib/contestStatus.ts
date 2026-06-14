import { getContestCalendarDate, getTodayString } from './dateUtils';

type ContestDates = {
  status: string;
  start_date: string;
  end_date: string;
};

export type ContestLifecycle = 'active' | 'upcoming' | 'ended' | 'draft' | 'completed';

export function getContestStartDate(contest: ContestDates): string {
  return getContestCalendarDate(contest.start_date);
}

export function getContestEndDate(contest: ContestDates): string {
  return getContestCalendarDate(contest.end_date);
}

/** Ended by calendar end date or explicit completed status. */
export function isContestEnded(contest: ContestDates): boolean {
  if (contest.status === 'completed') return true;
  const today = getTodayString();
  return today > getContestEndDate(contest);
}

/** Today falls within the challenge start/end calendar dates (inclusive). */
export function isContestInWindow(contest: ContestDates): boolean {
  if (contest.status === 'completed') return false;
  const today = getTodayString();
  const start = getContestStartDate(contest);
  const end = getContestEndDate(contest);
  return today >= start && today <= end;
}

export function isContestUpcoming(contest: ContestDates): boolean {
  if (isContestEnded(contest)) return false;
  const today = getTodayString();
  return today < getContestStartDate(contest);
}

/** User-facing lifecycle derived from dates first, then DB status. */
export function getContestLifecycle(contest: ContestDates): ContestLifecycle {
  if (contest.status === 'completed' || isContestEnded(contest)) return 'ended';
  if (contest.status === 'draft') return 'draft';
  if (isContestUpcoming(contest)) return 'upcoming';
  if (isContestInWindow(contest)) return 'active';
  return 'ended';
}

/** Running challenge the user can log against today. */
export function isContestActiveForLogging(contest: ContestDates): boolean {
  if (contest.status === 'completed') return false;
  if (contest.status === 'draft') return false;
  return isContestInWindow(contest);
}

/** Visible on dashboard without "Show ended" — not past end date. */
export function isContestVisibleOnDashboard(contest: ContestDates): boolean {
  if (contest.status === 'completed') return false;
  return !isContestEnded(contest);
}

export function lifecycleLabel(lifecycle: ContestLifecycle): string {
  switch (lifecycle) {
    case 'active':
      return 'Active';
    case 'upcoming':
      return 'Upcoming';
    case 'ended':
      return 'Ended';
    case 'draft':
      return 'Draft';
    case 'completed':
      return 'Completed';
  }
}

export function lifecycleBadgeClass(lifecycle: ContestLifecycle): string {
  switch (lifecycle) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'upcoming':
      return 'bg-blue-100 text-blue-800';
    case 'ended':
      return 'bg-gray-100 text-gray-600';
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'completed':
      return 'bg-yellow-100 text-yellow-800';
  }
}
