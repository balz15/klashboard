import { Capacitor } from '@capacitor/core';
import { initRouterFromBrowser, navigate, pathToRoute } from './router';

export async function initDeepLinks(): Promise<void> {
  initRouterFromBrowser();

  if (!Capacitor.isNativePlatform()) return;

  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        let pathname = url.pathname;
        if (url.protocol === 'klashboard:' && url.host === 'contest') {
          pathname = `/contest/${url.pathname.replace(/^\//, '')}`;
        }
        navigate(pathToRoute(pathname));
      } catch {
        /* ignore malformed URLs */
      }
    });
  } catch {
    console.warn('Deep link handler unavailable');
  }
}
