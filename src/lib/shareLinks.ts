import { Capacitor } from '@capacitor/core';

export function getPublicAppOrigin(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://www.klashboard.com';
}

export function getContestDeepLink(contestId: string): string {
  return `${getPublicAppOrigin()}/contest/${contestId}`;
}

export function getAndroidInstallLink(): string {
  const fromEnv = import.meta.env.VITE_ANDROID_INSTALL_URL as string | undefined;
  if (fromEnv) return fromEnv;
  return getPublicAppOrigin();
}

export function buildStatsShareMessage(opts: {
  contestName: string;
  contestId: string;
  userName: string;
  metricLabel: string;
  periodLabel: string;
  achieved: number;
  goal?: number;
  scorePct?: number;
  currentStreak: number;
  bestStreak: number;
  unit?: string;
}): string {
  const link = getContestDeepLink(opts.contestId);
  const install = getAndroidInstallLink();
  const goalLine =
    opts.goal != null && opts.goal > 0
      ? `${opts.periodLabel}: ${opts.achieved}${opts.unit ? ` ${opts.unit}` : ''} / ${opts.goal} (${opts.scorePct ?? 0}%)`
      : `${opts.periodLabel}: ${opts.achieved}${opts.unit ? ` ${opts.unit}` : ''}`;

  return `📊 ${opts.userName} on KlashBoard — "${opts.contestName}"

${opts.metricLabel}
${goalLine}
🔥 Streak ${opts.currentStreak}d · Best ${opts.bestStreak}d

Join the challenge: ${link}
Get the app: ${install}`;
}

export async function shareText(title: string, text: string, url?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false;
    }
  }
  return false;
}

export function openWhatsAppShare(text: string): void {
  const isMobile = Capacitor.isNativePlatform() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const url = isMobile
    ? `whatsapp://send?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

export function openInstagramShareHint(): void {
  window.open('https://www.instagram.com/', '_blank');
}
