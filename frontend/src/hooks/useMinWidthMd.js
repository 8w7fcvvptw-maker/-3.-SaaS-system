import { useState, useEffect } from "react";

const MD = 768;

/** true, если ширина viewport ≥ Tailwind md (как breakpoint md:). */
export function useMinWidthMd() {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(min-width: ${MD}px)`).matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return matches;
}
