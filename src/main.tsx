import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/** Run after first paint so a plugin error cannot block the UI from loading. */
void (async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { refreshReminders, initNativeNotifications } = await import('./lib/engagementReminders');
    const { initDeepLinks } = await import('./lib/deepLinks');

    if (Capacitor.isNativePlatform()) {
      await initNativeNotifications();
      await initNativeNotificationListener();
    }

    void refreshReminders().catch((err) => {
      console.warn('Could not sync reminders:', err);
    });
    await initDeepLinks();

    if (Capacitor.isNativePlatform()) {
      const { App: CapacitorApp } = await import('@capacitor/app');
      await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refreshReminders();
      });
    }
  } catch (err) {
    console.error('Native shell init failed:', err);
  }
})();
