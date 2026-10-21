import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'goodness-shake';

type MotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export const shakeSupported = (): boolean =>
  typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

export const shakeNeedsPermission = (): boolean =>
  shakeSupported() &&
  typeof (window.DeviceMotionEvent as MotionEventWithPermission).requestPermission === 'function';

export const shakeEnabledPref = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
};

export const setShakeEnabledPref = (on: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: ignore */
  }
};

/** Must be called from a tap (iPhone asks the user once). */
export async function requestShakePermission(): Promise<boolean> {
  if (!shakeSupported()) return false;
  const DME = window.DeviceMotionEvent as MotionEventWithPermission;
  if (typeof DME.requestPermission !== 'function') return true; // Android & desktop: no prompt needed
  try {
    return (await DME.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Calls onShake when the phone is shaken firmly (3 strong jolts within ~0.8s).
 * Ignores walking, pocket movement and single bumps.
 */
export function useShake(onShake: () => void, enabled: boolean) {
  const cb = useRef(onShake);
  cb.current = onShake;

  useEffect(() => {
    if (!enabled || !shakeSupported()) return;
    let hits: number[] = [];
    let lastFired = 0;

    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); // ~9.8 at rest
      if (magnitude < 24) return;
      const now = Date.now();
      hits = hits.filter((t) => now - t < 800);
      hits.push(now);
      if (hits.length >= 3 && now - lastFired > 2500) {
        lastFired = now;
        hits = [];
        if (navigator.vibrate) navigator.vibrate(40);
        cb.current();
      }
    };

    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [enabled]);
}
