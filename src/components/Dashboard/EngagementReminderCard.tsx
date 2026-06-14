import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Bell,
  BellOff,
  Smartphone,
  CheckCircle2,
  Circle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  getReminderPrefs,
  saveReminderPrefs,
  getReminderSetupStatus,
  requestNotificationPermission,
  prepareNativeReminderPermissions,
  openExactAlarmSettings,
  enableReminders,
  disableReminders,
  updateReminderSlots,
  sendTestReminderNotification,
  describeNativeSchedule,
  type ReminderSlot,
  type ReminderSetupStatus,
} from '../../lib/engagementReminders';
import {
  isChallengeReminderEnabled,
  setChallengeReminderEnabled,
  syncChallengeReminderList,
} from '../../lib/challengeReminderPrefs';

type ChallengeOption = { id: string; name: string };

type EngagementReminderCardProps = {
  challenges?: ChallengeOption[];
};

export function EngagementReminderCard({ challenges = [] }: EngagementReminderCardProps) {
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<ReminderSlot[]>([]);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [setup, setSetup] = useState<ReminderSetupStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  const showMessage = useCallback((text: string | null) => {
    setMessage(text);
    if (text) setExpanded(true);
  }, []);

  const refreshSetup = useCallback(async () => {
    if (!isNative) return;
    setSetupBusy(true);
    try {
      setSetup(await getReminderSetupStatus());
    } finally {
      setSetupBusy(false);
    }
  }, [isNative]);

  useEffect(() => {
    const prefs = getReminderPrefs();
    setEnabled(prefs.enabled);
    setSlots(prefs.slots);
    if (challenges.length) syncChallengeReminderList(challenges.map((c) => c.id));
    void refreshSetup();
  }, [challenges, refreshSetup]);

  useEffect(() => {
    if (!isNative) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshSetup();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isNative, refreshSetup]);

  const handleAllowNotifications = async () => {
    setSetupBusy(true);
    setMessage(null);
    try {
      const perm = await requestNotificationPermission();
      await refreshSetup();
      if (perm !== 'granted') {
        showMessage(
          'If Android did not show a prompt, open Settings → Apps → KlashBoard → Notifications and turn them on, then tap Refresh.'
        );
      }
    } finally {
      setSetupBusy(false);
    }
  };

  const handleOpenAlarmSettings = async () => {
    showMessage('Turn ON “Alarms & reminders”, press back, then tap Refresh here.');
    await openExactAlarmSettings();
  };

  const handleToggle = async () => {
    setMessage(null);
    setExpanded(true);

    if (enabled) {
      setToggleBusy(true);
      try {
        await disableReminders();
        setEnabled(false);
      } finally {
        setToggleBusy(false);
      }
      return;
    }

    setToggleBusy(true);
    try {
      if (isNative) {
        const prep = await prepareNativeReminderPermissions();
        setSetup(prep.status);
        if (!prep.ok) {
          showMessage(prep.message ?? 'Complete the phone setup steps below first.');
          return;
        }
      } else {
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          showMessage(
            perm === 'unsupported'
              ? 'Notifications are not supported in this browser.'
              : 'Allow notifications when your browser asks, or reset the site permission in browser settings.'
          );
          return;
        }
      }

      setEnabled(true);
      const result = await enableReminders(slots);
      if (!result.ok) {
        setEnabled(false);
        await disableReminders();
        showMessage(result.error ?? 'Could not turn reminders on.');
        return;
      }

      const parts = [
        isNative ? describeNativeSchedule(slots) : 'Reminders on while this tab stays open.',
      ];
      if (result.warning) parts.push(result.warning);
      showMessage(parts.join(' '));
      await refreshSetup();
    } catch (err) {
      setEnabled(false);
      await disableReminders();
      showMessage(err instanceof Error ? err.message : 'Could not turn reminders on.');
    } finally {
      setToggleBusy(false);
    }
  };

  const handleTest = async () => {
    setExpanded(true);
    setTestBusy(true);
    setMessage(null);
    try {
      if (isNative) {
        const prep = await prepareNativeReminderPermissions();
        setSetup(prep.status);
        if (prep.status.notifications !== 'granted') {
          showMessage(prep.message ?? 'Allow notifications first (Step 1 below).');
          return;
        }
      } else {
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          showMessage('Allow notifications in your browser when prompted.');
          return;
        }
      }

      const result = await sendTestReminderNotification();
      showMessage(
        result.ok
          ? 'Test sent — check your notification shade (phone) or corner popup (browser).'
          : (result.error ?? 'Test failed.')
      );
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTestBusy(false);
    }
  };

  const handleTimeChange = async (index: number, value: string) => {
    const [h, m] = value.split(':').map(Number);
    const next = [...slots];
    next[index] = { ...next[index], hour: h || 0, minute: m || 0 };
    setSlots(next);
    saveReminderPrefs({ enabled, slots: next });

    if (!enabled) {
      showMessage('Time saved. Complete phone setup below, then tap Enable reminders.');
      return;
    }

    setToggleBusy(true);
    try {
      const result = await updateReminderSlots(next);
      if (!result.ok) {
        showMessage(result.error ?? 'Could not update times.');
        return;
      }
      const parts = [describeNativeSchedule(next)];
      if (result.warning) parts.push(result.warning);
      showMessage(parts.join(' '));
    } finally {
      setToggleBusy(false);
    }
  };

  const notifOk = setup?.notifications === 'granted';
  const alarmsOk = setup?.exactAlarms === 'granted' || setup?.exactAlarms === 'not_applicable';
  const setupComplete = setup?.readyForScheduled ?? false;

  const statusBadge = enabled
    ? { label: 'On', className: 'bg-emerald-400/25 text-emerald-100' }
    : isNative && setup && !setupComplete
      ? { label: 'Setup needed', className: 'bg-amber-400/25 text-amber-100' }
      : { label: 'Off', className: 'bg-white/15 text-indigo-100' };

  return (
    <div
      className={`bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl shadow-md border border-indigo-500/30 text-white mb-6 ${
        expanded ? 'p-4' : 'p-3'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="p-1.5 bg-white/15 rounded-lg shrink-0">
          {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5 opacity-80" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">Daily check-in reminders</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            {isNative && (
              <span className="text-[10px] font-medium bg-white/15 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                3× daily
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-indigo-100/80 mt-0.5 truncate">
              {enabled
                ? 'Tap to change times or settings'
                : isNative
                  ? 'Tap to set up reminders on this phone'
                  : 'Tap to configure browser reminders'}
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-indigo-100 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <>
          <p className="text-xs text-indigo-100 mt-3 mb-1">
            {isNative
              ? 'Set your times, complete the 2-step phone setup, then enable. Test checks notifications only.'
              : 'Browser reminders work while this tab stays open. Use the phone app for background alerts.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testBusy || toggleBusy}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/15 text-white hover:bg-white/25 transition disabled:opacity-60"
            >
              {testBusy ? 'Testing…' : 'Test'}
            </button>
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={toggleBusy}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-white text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-60"
            >
              {toggleBusy ? 'Saving…' : enabled ? 'Turn off' : 'Enable reminders'}
            </button>
          </div>

      {isNative && setup && (
        <div className="mt-4 rounded-lg bg-black/20 border border-white/10 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              Phone setup {setupComplete ? '— ready' : '— required for scheduled times'}
            </p>
            <button
              type="button"
              onClick={() => void refreshSetup()}
              disabled={setupBusy}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-100 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${setupBusy ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <SetupStep
            done={notifOk}
            title="Step 1 — Notifications"
            detail="Lets KlashBoard show alerts on this phone."
            action={
              !notifOk ? (
                <button
                  type="button"
                  onClick={() => void handleAllowNotifications()}
                  disabled={setupBusy}
                  className="shrink-0 px-3 py-1.5 rounded-md bg-white text-indigo-700 text-xs font-semibold disabled:opacity-60"
                >
                  Allow
                </button>
              ) : null
            }
          />

          {setup.exactAlarms !== 'not_applicable' && (
            <SetupStep
              done={alarmsOk}
              title="Step 2 — Alarms & reminders"
              detail="Required for on-time daily alerts (Test does not need this)."
              action={
                !alarmsOk ? (
                  <button
                    type="button"
                    onClick={() => void handleOpenAlarmSettings()}
                    className="shrink-0 px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
                  >
                    Open alarm settings
                  </button>
                ) : null
              }
            />
          )}

          {!setupComplete && (
            <p className="text-xs text-indigo-100/90">
              After each step, tap <strong>Refresh</strong>. When both show ✓, tap <strong>Enable reminders</strong>.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {slots.map((slot, i) => (
          <div key={slot.label}>
            <label className="block text-xs font-medium text-indigo-200 mb-1">{slot.label}</label>
            <input
              type="time"
              value={`${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`}
              onChange={(e) => void handleTimeChange(i, e.target.value)}
              disabled={toggleBusy}
              className="w-full px-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {challenges.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs font-semibold text-indigo-100 mb-2">Remind me for:</p>
          <div className="flex flex-wrap gap-2">
            {challenges.map((c) => (
              <label
                key={c.id}
                className="inline-flex items-center gap-2 text-sm bg-white/10 rounded-lg px-3 py-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChallengeReminderEnabled(c.id)}
                  onChange={(e) => setChallengeReminderEnabled(c.id, e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="truncate max-w-[140px]">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

          {message && (
            <p className="text-xs text-indigo-100 mt-3 bg-black/10 rounded-lg p-2">{message}</p>
          )}
        </>
      )}
    </div>
  );
}

function SetupStep({
  done,
  title,
  detail,
  action,
}: {
  done: boolean;
  title: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-white/5 px-3 py-2">
      <div className="flex gap-2 min-w-0">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
        ) : (
          <Circle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-indigo-100/90">{detail}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
