import { Capacitor } from '@capacitor/core';
import { getLocalDateString } from './dateUtils';

const STORAGE_KEY = 'clashboard_daily_reminder_v1';
const NATIVE_NOTIFICATION_ID = 88201;

export type ReminderPrefs = {
  enabled: boolean;
  hour: number;
  minute: number;
};

function loadPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, hour: 18, minute: 0 };
    const p = JSON.parse(raw) as ReminderPrefs;
    return {
      enabled: !!p.enabled,
      hour: Math.min(23, Math.max(0, Number(p.hour) || 18)),
      minute: Math.min(59, Math.max(0, Number(p.minute) || 0)),
    };
  } catch {
    return { enabled: false, hour: 18, minute: 0 };
  }
}

export function getReminderPrefs(): ReminderPrefs {
  return loadPrefs();
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

let webTimer: ReturnType<typeof setInterval> | null = null;
let webLastFiredDay: string | null = null;

function todayKey(): string {
  return getLocalDateString(new Date());
}

async function showBrowserNotification(title: string, body: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'clashboard-daily' });
  } catch {
    /* ignore */
  }
}

function startWebReminderLoop(hour: number, minute: number): void {
  if (webTimer) {
    clearInterval(webTimer);
    webTimer = null;
  }
  webTimer = setInterval(() => {
    const prefs = loadPrefs();
    if (!prefs.enabled) return;
    const now = new Date();
    if (now.getHours() !== hour || now.getMinutes() !== minute) return;
    const key = todayKey();
    if (webLastFiredDay === key) return;
    webLastFiredDay = key;
    void showBrowserNotification(
      'Time to check in',
      "Don't lose your streak — open Group Challenge and log today's progress."
    );
  }, 30_000);
}

function stopWebReminderLoop(): void {
  if (webTimer) {
    clearInterval(webTimer);
    webTimer = null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

async function scheduleNativeDaily(hour: number, minute: number): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') return;
  }

  await LocalNotifications.cancel({ notifications: [{ id: NATIVE_NOTIFICATION_ID }] });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NATIVE_NOTIFICATION_ID,
        title: 'Time to check in',
        body: "Don't lose your streak — open the app and log today's progress.",
        schedule: {
          allowWhileIdle: true,
          on: { hour, minute },
        },
      },
    ],
  });
}

async function cancelNative(): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: NATIVE_NOTIFICATION_ID }] });
  } catch {
    /* plugin missing in web dev */
  }
}

/**
 * Apply saved prefs: schedules OS notifications on Android/iOS, lightweight web polling in the browser.
 */
export async function applyReminderScheduleFromStorage(): Promise<void> {
  const prefs = loadPrefs();
  if (!prefs.enabled) {
    stopWebReminderLoop();
    await cancelNative();
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await scheduleNativeDaily(prefs.hour, prefs.minute);
    stopWebReminderLoop();
    return;
  }

  await cancelNative();
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    startWebReminderLoop(prefs.hour, prefs.minute);
  } else {
    stopWebReminderLoop();
  }
}

export async function setRemindersEnabled(
  enabled: boolean,
  hour: number,
  minute: number
): Promise<void> {
  saveReminderPrefs({ enabled, hour, minute });
  await applyReminderScheduleFromStorage();
}
