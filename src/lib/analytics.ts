declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

export const pageview = (url: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', 'G-E1CYV16817', {
      page_path: url,
    });
  }
};

export const event = (action: string, params?: Record<string, unknown>) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, params);
  }
};
