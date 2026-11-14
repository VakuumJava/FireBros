import { useEffect, useState } from "react";

const VIEWS = ["explore", "calendar", "method", "export"];
const viewFromHash = () => {
  const requested = window.location.hash?.slice(1);
  return VIEWS.includes(requested) ? requested : "explore";
};

export function useSectionNavigation() {
  const [active, setActive] = useState(viewFromHash);

  useEffect(() => {
    const update = () => setActive(viewFromHash());
    window.addEventListener?.("hashchange", update);
    return () => window.removeEventListener?.("hashchange", update);
  }, []);

  const select = (view) => {
    if (!VIEWS.includes(view)) return;
    setActive(view);
    window.history?.replaceState(
      null,
      "",
      `${window.location.pathname || ""}${window.location.search || ""}#${view}`,
    );
  };

  return { active, select };
}
