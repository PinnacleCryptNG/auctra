import { useSyncExternalStore } from "react";
import { getPath, navigate, subscribe } from "./router";

export function usePathname() {
  return useSyncExternalStore(subscribe, getPath, getPath);
}
export function useSearchParams() {
  return new URLSearchParams();
}
export function useRouter() {
  return { push: navigate, replace: navigate, back: () => navigate("/dashboard"), refresh: () => {} };
}
