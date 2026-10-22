// Sound and buzz when a shake is caught.
// iPhone rules: sound can only start after the person has tapped the page once,
// and Safari has no vibrate(), so we use the system haptic of a hidden switch (iOS 18+).

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;

/** Call from a real tap. Safe to call many times. */
export function unlockSound() {
  try {
    const nav = navigator as AudioSessionNav;
    // 'ambient' = respect the phone's silent switch
    if (nav.audioSession) nav.audioSession.type = 'ambient';
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    // a silent blip fully unlocks audio on older iPhones
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {
    /* no sound available */
  }
}

/** A short two-note chime. */
export function ding() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  [
    { f: 1046.5, t: 0 }, // C6
    { f: 1568, t: 0.09 }, // G6
  ].forEach(({ f, t }) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.45);
    o.connect(g).connect(ctx!.destination);
    o.start(now + t);
    o.stop(now + t + 0.5);
  });
}

let hapticLabel: HTMLLabelElement | null = null;

/** A short buzz: vibrate() on Android, switch-toggle haptic on iPhone. */
export function buzz() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([30, 40, 30]);
      return;
    }
    if (!hapticLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'gt-haptic';
      input.style.display = 'none';
      hapticLabel = document.createElement('label');
      hapticLabel.htmlFor = 'gt-haptic';
      hapticLabel.style.display = 'none';
      hapticLabel.setAttribute('aria-hidden', 'true');
      document.body.append(input, hapticLabel);
    }
    hapticLabel.click();
    setTimeout(() => hapticLabel?.click(), 120);
  } catch {
    /* no haptics available */
  }
}

export function shakeFeedback() {
  buzz();
  ding();
}
