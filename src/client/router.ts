import { useEffect, useState } from "react";

/** ごく軽量なハッシュルーター（依存ライブラリなし） */
export type Route = "home" | "prices" | "detail" | "settings";

const VALID: Route[] = ["home", "prices", "detail", "settings"];

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (VALID as string[]).includes(h) ? (h as Route) : "home";
}

export function navigate(route: Route) {
  window.location.hash = `#/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
