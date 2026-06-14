import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';
import { getTodayString } from './dateUtils';
import { isChallengeReminderEnabled } from './challengeReminderPrefs';
import { isContestActiveForLogging } from './contestStatus';

export type ReminderSlot = { hour: number; minute: number; label: string };

export type ReminderPrefs = {
  enabled: boolean;
  slots: ReminderSlot[];
};

export type ReminderResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

const STORAGE_KEY = 'clashboard_daily_reminder_v2';
const NATIVE_IDS = [88201, 88202, 88203];
const ANDROID_CHANNEL_ID = 'klashboard_reminders_v2';
const PERMISSION_TIMEOUT_MS = 8_000;
const NATIVE_OP_TIMEOUT_MS = 8_000;

const DEFAULT_SLOTS: ReminderSlot[] = [
  { hour: 9, minute: 0, label: 'Morning' },
  { hour: 14, minute: 0, label: 'Afternoon' },
  { hour: 20, minute: 0, label: 'Evening' },
];

let webTimer: ReturnType<typeof setInterval> | null = null;
let cachedUserId: string | null = null;
let refreshInFlight: Promise<ReminderResult> | null = null;
let nativeChannelReady = false;
let nativeListenerRegistered = false;

function loadPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, slots: DEFAULT_SLOTS };
    const p = JSON.parse(raw) as ReminderPrefs;
    return {
      enabled: !!p.enabled,
      slots: Array.isArray(p.slots) && p.slots.length === 3 ? p.slots : DEFAULT_SLOTS,
    };
  } catch {
    return { enabled: false, slots: DEFAULT_SLOTS };
  }
}

export function getReminderPrefs(): ReminderPrefs {
  return loadPrefs();
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Android 8+ channel — omit `sound` so the system default tone is used (`sound: 'default'` breaks). */
export async function initNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || nativeChannelReady) return;
  try {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await LocalNotifications.deleteChannel({ id: 'klashboard_reminders' });
      } catch {
        /* ignore */
      }
      await LocalNotifications.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: 'Daily check-in reminders',
        description: 'Reminds you to log progress in your challenges',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    }
    nativeChannelReady = true;
  } catch (err) {
    console.warn('Could not create notification channel:', err);
  }
}

export type ReminderSetupStatus = {
  notifications: 'granted' | 'denied' | 'prompt' | 'unsupported';
  exactAlarms: 'granted' | 'denied' | 'not_applicable';
  readyForScheduled: boolean;
};

export async function getReminderSetupStatus(): Promise<ReminderSetupStatus> {
  const notifications = await getNotificationPermission();
  let exactAlarms: ReminderSetupStatus['exactAlarms'] = 'not_applicable';

  if (Capacitor.getPlatform() === 'android') {
    try {
      const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
      exactAlarms = exact_alarm === 'granted' ? 'granted' : 'denied';
    } catch {
      exactAlarms = 'denied';
    }
  }

  const readyForScheduled =
    notifications === 'granted' &&
    (exactAlarms === 'granted' || exactAlarms === 'not_applicable');

  return { notifications, exactAlarms, readyForScheduled };
}

/** Opens Android "Alarms & reminders" screen for this app. */
export async function openExactAlarmSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.changeExactNotificationSetting();
}

/** Step 1: notification prompt. Does not open alarm settings automatically. */
export async function prepareNativeReminderPermissions(): Promise<{
  ok: boolean;
  status: ReminderSetupStatus;
  message?: string;
}> {
  const notif = await requestNotificationPermission();
  const status = await getReminderSetupStatus();

  if (notif !== 'granted') {
    return {
      ok: false,
      status,
      message:
        notif === 'denied'
          ? 'Step 1 — In phone Settings → Apps → KlashBoard → Notifications, turn notifications ON. Then tap Refresh below.'
          : 'Notifications are not supported on this device.',
    };
  }

  if (!status.readyForScheduled) {
    return {
      ok: false,
      status,
      message:
        'Step 2 — Tap "Open alarm settings" below, turn ON Alarms & reminders, come back, tap Refresh, then Enable.',
    };
  }

  return { ok: true, status };
}

async function getExactAlarmWarning(): Promise<string | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    if (exact_alarm === 'granted') return null;
    return 'Allow Alarms & reminders in Settings → Apps → KlashBoard for on-time alerts.';
  } catch {
    return null;
  }
}

async function verifyNativeSchedulePending(): Promise<string | null> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    const pendingIds = new Set(notifications.map((n) => n.id));
    if (NATIVE_IDS.some((id) => pendingIds.has(id))) return null;
    return 'Phone did not register the alert. Allow Alarms & reminders for KlashBoard, then turn reminders off and on.';
  } catch {
    return null;
  }
}

async function waitForRefresh(): Promise<void> {
  if (refreshInFlight) {
    await refreshInFlight.catch(() => {});
  }
}

export function setReminderUserId(userId: string | null): void {
  cachedUserId = userId;
}

/** Fast read — does not show a permission dialog. */
export async function getNotificationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNativeNotifications();
      const status = await withTimeout(
        LocalNotifications.checkPermissions(),
        5000,
        'Notification check'
      );
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

/** Ask once if needed; never blocks forever. */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  const current = await getNotificationPermission();
  if (current === 'granted') return 'granted';
  if (current === 'denied' || current === 'unsupported') {
    return current === 'denied' ? 'denied' : 'unsupported';
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await initNativeNotifications();
      const perm = await withTimeout(
        LocalNotifications.requestPermissions(),
        PERMISSION_TIMEOUT_MS,
        'Notification permission'
      );
      return perm.display === 'granted' ? 'granted' : 'denied';
    } catch (err) {
      console.warn(err);
      return 'denied';
    }
  }

  try {
    const result = await withTimeout(
      Notification.requestPermission(),
      PERMISSION_TIMEOUT_MS,
      'Notification permission'
    );
    return result === 'granted' ? 'granted' : 'denied';
  } catch (err) {
    console.warn(err);
    return 'denied';
  }
}

async function cancelNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await withTimeout(
      LocalNotifications.cancel({ notifications: NATIVE_IDS.map((id) => ({ id })) }),
      NATIVE_OP_TIMEOUT_MS,
      'Cancel reminders'
    );
  } catch {
    /* ignore */
  }
}

export async function hasPendingEntriesToday(userId: string): Promise<boolean> {
  const { data: parts } = await supabase
    .from('contest_participants')
    .select('id, contest_id, contests(start_date, end_date, status)')
    .eq('user_id', userId)
    .is('left_at', null);

  if (!parts?.length) return false;

  const participantIds = parts.map((p) => p.id);
  const { data: todayLogs } = await supabase
    .from('submissions')
    .select('contest_id')
    .in('participant_id', participantIds)
    .eq('submission_date', getTodayString());

  const logged = new Set((todayLogs || []).map((s) => s.contest_id));

  return parts.some((p) => {
    const contest = p.contests as { start_date: string; end_date: string; status: string } | null;
    if (!contest || !isContestActiveForLogging(contest)) return false;
    if (!isChallengeReminderEnabled(p.contest_id)) return false;
    return !logged.has(p.contest_id);
  });
}

function nextFireAt(slot: ReminderSlot, after = new Date()): Date {
  const at = new Date(after);
  at.setSeconds(0, 0);
  at.setMilliseconds(0);
  at.setHours(slot.hour, slot.minute, 0, 0);
  if (at.getTime() <= after.getTime()) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

function nativeAtPayload(id: number, title: string, body: string, at: Date) {
  return {
    id,
    title,
    body,
    channelId: ANDROID_CHANNEL_ID,
    smallIcon: 'ic_stat_klashboard',
    schedule: { at, allowWhileIdle: true },
  };
}

function nativeImmediatePayload(id: number, title: string, body: string, delayMs: number) {
  return nativeAtPayload(id, title, body, new Date(Date.now() + delayMs));
}

async function scheduleNativeSlot(slotIndex: number, slots: ReminderSlot[]): Promise<void> {
  const slot = slots[slotIndex];
  if (!slot) return;
  const id = NATIVE_IDS[slotIndex];
  await LocalNotifications.cancel({ notifications: [{ id }] });
  await LocalNotifications.schedule({
    notifications: [
      nativeAtPayload(
        id,
        'KlashBoard check-in',
        "Log today's progress — keep your streak alive!",
        nextFireAt(slot)
      ),
    ],
  });
}

/** Re-schedule one daily slot after it fires (same mechanism as Test button). */
async function rescheduleNativeSlot(slotIndex: number): Promise<void> {
  const prefs = loadPrefs();
  if (!prefs.enabled) return;
  if (cachedUserId && !(await hasPendingEntriesToday(cachedUserId))) return;
  await scheduleNativeSlot(slotIndex, prefs.slots);
}

/** Listen for fired reminders and queue the next day — `on:` cron alarms are unreliable in Doze. */
export async function initNativeNotificationListener(): Promise<void> {
  if (!Capacitor.isNativePlatform() || nativeListenerRegistered) return;
  nativeListenerRegistered = true;

  await LocalNotifications.addListener('localNotificationReceived', (notification) => {
    const slotIndex = NATIVE_IDS.indexOf(notification.id);
    if (slotIndex === -1) return;
    void rescheduleNativeSlot(slotIndex);
  });
}

async function scheduleNativeReminders(slots: ReminderSlot[]): Promise<ReminderResult> {
  try {
    await initNativeNotifications();
    const perm = await getNotificationPermission();
    if (perm !== 'granted') {
      return {
        ok: false,
        error: 'Notifications are off for KlashBoard. Enable them in Android Settings → Apps → KlashBoard → Notifications.',
      };
    }

    const alarmWarning = await getExactAlarmWarning();

    await cancelNativeReminders();

    await withTimeout(
      LocalNotifications.schedule({
        notifications: slots.map((slot, i) =>
          nativeAtPayload(
            NATIVE_IDS[i],
            'KlashBoard check-in',
            "Log today's progress — keep your streak alive!",
            nextFireAt(slot)
          )
        ),
      }),
      NATIVE_OP_TIMEOUT_MS,
      'Schedule reminders'
    );

    const verifyError = await verifyNativeSchedulePending();
    if (verifyError) {
      return { ok: false, error: verifyError };
    }

    return { ok: true, warning: alarmWarning ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not schedule phone reminders.';
    return { ok: false, error: message };
  }
}

export function describeNativeSchedule(slots: ReminderSlot[]): string {
  const nextTimes = slots
    .map((slot) => {
      const at = nextFireAt(slot);
      const hh = String(at.getHours()).padStart(2, '0');
      const mm = String(at.getMinutes()).padStart(2, '0');
      const day =
        at.toDateString() === new Date().toDateString()
          ? 'today'
          : at.toDateString() === new Date(Date.now() + 86400000).toDateString()
            ? 'tomorrow'
            : at.toLocaleDateString();
      return `${slot.label} ${hh}:${mm} ${day}`;
    })
    .join('; ');
  return `Next alerts — ${nextTimes}.`;
}

function stopWebReminders(): void {
  if (webTimer) {
    clearInterval(webTimer);
    webTimer = null;
  }
}

function startWebReminders(slots: ReminderSlot[]): void {
  stopWebReminders();
  const fired = new Set<string>();

  webTimer = setInterval(() => {
    const prefs = loadPrefs();
    if (!prefs.enabled || !cachedUserId) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    for (const slot of slots) {
      if (now.getHours() !== slot.hour || now.getMinutes() !== slot.minute) continue;
      const key = `${getTodayString()}-${slot.hour}-${slot.minute}`;
      if (fired.has(key)) continue;
      fired.add(key);
      void (async () => {
        if (!(await hasPendingEntriesToday(cachedUserId!))) return;
        new Notification('KlashBoard check-in', {
          body: "You still have entries to log today — open KlashBoard.",
          icon: './favicon.ico',
        });
      })();
    }
  }, 30_000);
}

async function applyNativeOrWebSchedule(slots: ReminderSlot[]): Promise<ReminderResult> {
  if (Capacitor.isNativePlatform()) {
    return scheduleNativeReminders(slots);
  }
  if (typeof window !== 'undefined' && Notification.permission === 'granted') {
    startWebReminders(slots);
    return { ok: true };
  }
  return { ok: false, error: 'Allow notifications in this browser first.' };
}

/**
 * Background sync after app resume or logging.
 * @param cancelNativeWhenNothingDue — true after the user logs (clears rest-of-day alarms)
 */
export async function refreshReminders(cancelNativeWhenNothingDue = false): Promise<ReminderResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const prefs = loadPrefs();

    if (!prefs.enabled) {
      stopWebReminders();
      await cancelNativeReminders();
      return { ok: true };
    }

    if (cachedUserId && !(await hasPendingEntriesToday(cachedUserId))) {
      stopWebReminders();
      if (cancelNativeWhenNothingDue) {
        await cancelNativeReminders();
      }
      return { ok: true };
    }

    return applyNativeOrWebSchedule(loadPrefs().slots);
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function refreshRemindersAfterLogging(): Promise<ReminderResult> {
  return refreshReminders(true);
}

export async function syncRemindersFromStorage(): Promise<ReminderResult> {
  return refreshReminders(false);
}
export async function enableReminders(slots: ReminderSlot[]): Promise<ReminderResult> {
  saveReminderPrefs({ enabled: true, slots });
  await waitForRefresh();
  return applyNativeOrWebSchedule(slots);
}

export async function disableReminders(): Promise<ReminderResult> {
  saveReminderPrefs({ enabled: false, slots: loadPrefs().slots });
  stopWebReminders();
  await cancelNativeReminders();
  return { ok: true };
}

export async function updateReminderSlots(slots: ReminderSlot[]): Promise<ReminderResult> {
  const prefs = loadPrefs();
  saveReminderPrefs({ enabled: prefs.enabled, slots });
  if (!prefs.enabled) return { ok: true };
  await waitForRefresh();
  return applyNativeOrWebSchedule(slots);
}

export async function sendTestReminderNotification(): Promise<ReminderResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      await initNativeNotifications();
      const perm = await getNotificationPermission();
      if (perm !== 'granted') {
        return {
          ok: false,
          error: 'Notifications are off. Enable them in Settings → Apps → KlashBoard → Notifications.',
        };
      }

      await withTimeout(
        LocalNotifications.schedule({
          notifications: [
            nativeImmediatePayload(
              99999,
              'KlashBoard test',
              'If you see this, phone notifications are working.',
              800
            ),
          ],
        }),
        NATIVE_OP_TIMEOUT_MS,
        'Test notification'
      );
      return { ok: true };
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return { ok: false, error: 'Allow notifications in your browser first.' };
    }
    new Notification('KlashBoard test', {
      body: 'If you see this, notifications work in your browser.',
      icon: './favicon.ico',
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test notification failed.';
    return { ok: false, error: message };
  }
}

export async function notifyGroupEvent(title: string, body: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await initNativeNotifications();
      await LocalNotifications.schedule({
        notifications: [
          nativeImmediatePayload(
            Math.floor(Math.random() * 100000),
            title,
            body,
            500
          ),
        ],
      });
      return;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: './favicon.ico' });
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated use refreshReminders */
export const applyReminderScheduleFromStorage = refreshReminders;
