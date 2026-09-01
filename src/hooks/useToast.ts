import { useEffect, useRef, useState } from "react";

/** Short-lived status message; the timer is cleared on unmount. */
export function useToast(durationMs = 1800) {
  const [message, setMessage] = useState("");
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function showToast(next: string) {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(""), durationMs);
  }

  return { message, showToast };
}
