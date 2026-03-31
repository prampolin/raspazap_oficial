"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

/** 1 hora sem atividade → logout (sem contador na UI). */
const IDLE_MS = 60 * 60 * 1000;
/** Evita reagendar o timer centenas de vezes por segundo (ex.: scroll). */
const THROTTLE_MS = 30_000;

export function IdleSessionTimeout() {
  const { user, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleRef = useRef(0);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut();
      }, IDLE_MS);
    };

    schedule();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < THROTTLE_MS) return;
      lastThrottleRef.current = now;
      schedule();
    };

    const events: (keyof DocumentEventMap)[] = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "visibilitychange",
    ];

    events.forEach((ev) => {
      document.addEventListener(ev, onActivity, { passive: true } as AddEventListenerOptions);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => document.removeEventListener(ev, onActivity));
    };
  }, [user, signOut]);

  return null;
}
