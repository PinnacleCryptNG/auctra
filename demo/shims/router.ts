// In-memory router for the sandbox: the dashboard's links and usePathname()
// work without a server. (The artifact frame can't use URL paths.)
type Listener = () => void;
let path = "/dashboard";
const listeners = new Set<Listener>();

export function getPath() {
  return path;
}
export function navigate(next: string) {
  const [pathname] = next.split(/[?#]/);
  if (pathname === path) return;
  path = pathname;
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}
export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
