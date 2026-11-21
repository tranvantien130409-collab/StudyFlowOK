import { loadUiPreferences } from './uiPreferences';

export type TactileSoundKind = 'tap' | 'nav' | 'toggle' | 'flip' | 'success' | 'none';

let sharedAudioCtx: AudioContext | null = null;
let lastSoundTimestamp = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function isTactileSoundEnabled(): boolean {
  try {
    return loadUiPreferences().soundEnabled !== false;
  } catch {
    return true;
  }
}

export function isHapticsEnabled(): boolean {
  try {
    return loadUiPreferences().hapticsEnabled !== false;
  } catch {
    return true;
  }
}

export function triggerHaptic(pattern: number | number[] = 7): void {
  if (!isHapticsEnabled()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore on unsupported browsers
  }
}

function throttleOk(minGapMs = 38): boolean {
  const now = performance.now();
  if (now - lastSoundTimestamp < minGapMs) return false;
  lastSoundTimestamp = now;
  return true;
}

/**
 * Ultra-soft crystalline micro-tap for buttons & cards
 */
export function playSoftTap(): void {
  if (!isTactileSoundEnabled() || !throttleOk(32)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const pitchFactor = 0.97 + Math.random() * 0.06;

    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(490 * pitchFactor, now);
    osc.frequency.exponentialRampToValueAtTime(270 * pitchFactor, now + 0.032);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(980 * pitchFactor, now);
    overtone.frequency.exponentialRampToValueAtTime(620 * pitchFactor, now + 0.024);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.034, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    overtoneGain.gain.setValueAtTime(0.0001, now);
    overtoneGain.gain.linearRampToValueAtTime(0.01, now + 0.003);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

    osc.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.042);
    overtone.stop(now + 0.03);
  } catch {
    // ignore
  }
}

/**
 * Silky two-note harmonic glide for navigation tab switches
 */
export function playNavSwitch(): void {
  if (!isTactileSoundEnabled() || !throttleOk(40)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 783.99]; // C5 -> G5 open crystal fifth
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.026;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.075);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.026 : 0.034, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.1);
    });
  } catch {
    // ignore
  }
}

/**
 * Subtle ascending or descending chime for toggles & theme/sound switches
 */
export function playToggleChime(isOn = true): void {
  if (!isTactileSoundEnabled() || !throttleOk(40)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = isOn ? 440 : 587.33;
    const endFreq = isOn ? 659.25 : 440;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.082);
  } catch {
    // ignore
  }
}

/**
 * Crisp airy card-flip feedback
 */
export function playCardFlipSound(): void {
  if (!isTactileSoundEnabled() || !throttleOk(50)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.055);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.036, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.072);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.076);
  } catch {
    // ignore
  }
}

/**
 * Warm ascending sparkle chord for task completion & primary AI actions
 */
export function playSuccessSparkle(): void {
  if (!isTactileSoundEnabled() || !throttleOk(55)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6 soft glass arpeggio
    freqs.forEach((freq, idx) => {
      const start = now + idx * 0.034;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(idx === 3 ? 0.026 : 0.036, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // ignore
  }
}

export function playTactileFeedback(kind: TactileSoundKind = 'tap'): void {
  if (kind === 'none') return;
  switch (kind) {
    case 'nav':
      triggerHaptic(8);
      playNavSwitch();
      break;
    case 'toggle':
      triggerHaptic(7);
      playToggleChime(true);
      break;
    case 'flip':
      triggerHaptic(9);
      playCardFlipSound();
      break;
    case 'success':
      triggerHaptic([10, 24, 12]);
      playSuccessSparkle();
      break;
    case 'tap':
    default:
      triggerHaptic(6);
      playSoftTap();
      break;
  }
}
