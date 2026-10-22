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
 * Calls onShake when the phone is shaken (3 quick back-and-forth jolts within ~1s).
 * Looks at sudden changes between motion readings, so walking and single bumps are ignored.
 * onAlive fires once the first motion reading arrives (proves the sensor is reachable).
 */
export function useShake(onShake: () => void, enabled: boolean, onAlive?: () => void) {
  const cb = useRef(onShake);
  cb.current = onShake;
  const alive = useRef(onAlive);
  alive.current = onAlive;

  useEffect(() => {
    if (!enabled || !shakeSupported()) return;
    let hits: number[] = [];
    let lastHit = 0;
    let lastFired = 0;
    let prev: { x: number; y: number; z: number } | null = null;
    let sawData = false;

    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      if (!sawData) {
        sawData = true;
        alive.current?.();
      }
      const cur = { x: a.x, y: a.y, z: a.z };
      if (!prev) {
        prev = cur;
        return;
      }
      const delta = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) + Math.abs(cur.z - prev.z);
      prev = cur;
      if (delta < 14) return;
      const now = Date.now();
      if (now - lastHit < 90) return; // one jolt = one hit
      lastHit = now;
      hits = hits.filter((t) => now - t < 1000);
      hits.push(now);
      if (hits.length >= 3 && now - lastFired > 2500) {
        lastFired = now;
        hits = [];
        cb.current();
      }
    };

    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [enabled]);
}
