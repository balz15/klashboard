import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  getReminderPrefs,
  requestNotificationPermission,
  setRemindersEnabled,
  applyReminderScheduleFromStorage,
} from '../../lib/engagementReminders';

export function EngagementReminderCard() {
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const p = getReminderPrefs();
    setEnabled(p.enabled);
    setHour(p.hour);
    setMinute(p.minute);
    void applyReminderScheduleFromStorage();
  }, []);

  const isNative = Capacitor.isNativePlatform();

  const handleToggle = async () => {
    setSaving(true);
    setHint(null);
    try {
      if (!enabled) {
        const perm = await requestNotificationPermission();
        if (perm === 'denied') {
          setHint('Notifications are blocked for this site or app. Enable them in system settings.');
          setSaving(false);
          return;
        }
        if (perm === 'unsupported') {
          setHint('This browser does not support notifications.');
          setSaving(false);
          return;
        }
        await setRemindersEnabled(true, hour, minute);
        setEnabled(true);
        setHint(
          isNative
            ? 'You will get a daily reminder at the time you chose.'
            : 'Keep this site open in a tab, or install the Android app for reminders when the browser is closed.'
        );
      } else {
        await setRemindersEnabled(false, hour, minute);
        setEnabled(false);
        setHint(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveTime = async () => {
    if (!enabled) return;
    setSaving(true);
    try {
      await setRemindersEnabled(true, hour, minute);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl shadow-md border border-indigo-500/30 p-5 text-white mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-white/15 rounded-lg shrink-0">
            {enabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6 opacity-80" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold flex flex-wrap items-center gap-2">
              Daily check-in reminder
              {isNative && (
                <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  Works in background
                </span>
              )}
            </h2>
            <p className="text-sm text-indigo-100 mt-1">
              A gentle nudge to log progress and protect your streak — similar to habit apps you may know.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          className="shrink-0 px-5 py-2.5 rounded-lg font-semibold bg-white text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-60 w-full sm:w-auto"
        >
          {saving ? 'Saving…' : enabled ? 'Turn off' : 'Enable reminders'}
        </button>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-indigo-200 mb-1">Reminder time</label>
          <input
            type="time"
            value={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              setHour(h || 0);
              setMinute(m || 0);
            }}
            onBlur={saveTime}
            disabled={!enabled || saving}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-indigo-200 disabled:opacity-50"
          />
        </div>
        {enabled && (
          <p className="text-xs text-indigo-200 sm:pb-2">
            Change the time and click outside the field to save.
          </p>
        )}
      </div>

      {hint && <p className="text-xs text-indigo-100 mt-3 bg-black/10 rounded-lg p-2">{hint}</p>}
    </div>
  );
}
