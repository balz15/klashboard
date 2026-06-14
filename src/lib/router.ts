type Route = '/' | '/auth' | '/about' | '/dashboard' | '/templates/community' | `/contest/${string}`;

type Listener = (route: Route) => void;

let currentRoute: Route = '/';
const listeners: Set<Listener> = new Set();

export function pathToRoute(pathname: string): Route {
  const contestMatch = pathname.match(/^\/contest\/([a-f0-9-]+)\/?$/i);
  if (contestMatch) return `/contest/${contestMatch[1]}` as Route;
  if (pathname === '/auth' || pathname === '/auth/') return '/auth';
  if (pathname === '/about' || pathname === '/about/') return '/about';
  if (pathname === '/dashboard' || pathname === '/dashboard/') return '/dashboard';
  if (pathname === '/templates/community' || pathname === '/templates/community/') {
    return '/templates/community';
  }
  if (pathname === '/' || pathname === '') return '/';
  return '/';
}

export function initRouterFromBrowser(): Route {
  if (typeof window === 'undefined') return currentRoute;
  currentRoute = pathToRoute(window.location.pathname);
  return currentRoute;
}

export function navigate(path: Route) {
  currentRoute = path;
  if (typeof window !== 'undefined' && window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  listeners.forEach((fn) => fn(path));
}

export function getCurrentRoute(): Route {
  return currentRoute;
}

export function onRouteChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeToBrowserNavigation(onPop: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => {
    currentRoute = pathToRoute(window.location.pathname);
    onPop();
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}

export type { Route };
