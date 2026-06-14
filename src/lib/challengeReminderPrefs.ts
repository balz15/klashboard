const CHALLENGE_PREFS_KEY = 'clashboard_challenge_reminder_prefs_v1';

export type ChallengeReminderPref = {
  contestId: string;
  enabled: boolean;
};

export function getChallengeReminderPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHALLENGE_PREFS_KEY);
    if (!raw) return {};
    const list = JSON.parse(raw) as ChallengeReminderPref[];
    return Object.fromEntries(list.map((p) => [p.contestId, p.enabled]));
  } catch {
    return {};
  }
}

export function isChallengeReminderEnabled(contestId: string): boolean {
  const prefs = getChallengeReminderPrefs();
  if (contestId in prefs) return prefs[contestId];
  return true;
}

export function setChallengeReminderEnabled(contestId: string, enabled: boolean): void {
  const prefs = getChallengeReminderPrefs();
  prefs[contestId] = enabled;
  localStorage.setItem(
    CHALLENGE_PREFS_KEY,
    JSON.stringify(Object.entries(prefs).map(([id, en]) => ({ contestId: id, enabled: en })))
  );
}

export function syncChallengeReminderList(contestIds: string[]): void {
  const prefs = getChallengeReminderPrefs();
  let changed = false;
  contestIds.forEach((id) => {
    if (!(id in prefs)) {
      prefs[id] = true;
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem(
      CHALLENGE_PREFS_KEY,
      JSON.stringify(Object.entries(prefs).map(([id, en]) => ({ contestId: id, enabled: en })))
    );
  }
}
