type Route = '/' | '/auth' | '/about' | '/dashboard' | `/contest/${string}`;

type Listener = (route: Route) => void;

let currentRoute: Route = '/';
const listeners: Set<Listener> = new Set();

export function navigate(path: Route) {
  currentRoute = path;
  listeners.forEach(fn => fn(path));
}

export function getCurrentRoute(): Route {
  return currentRoute;
}

export function onRouteChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
