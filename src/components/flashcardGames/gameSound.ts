import { isTactileSoundEnabled } from '../../utils/tactileAudio';

let gameAudioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !isTactileSoundEnabled()) return null;
  try {
    if (!gameAudioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      gameAudioCtx = new Ctx();
    }
    if (gameAudioCtx.state === 'suspended') {
      gameAudioCtx.resume().catch(() => {});
    }
    return gameAudioCtx;
  } catch {
    return null;
  }
}

export function playGameTone(
  type: 'match' | 'wrong' | 'laser' | 'shatter' | 'block_place' | 'line_clear' | 'charm_pop' | 'victory' | 'claim'
): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    if (type === 'match' || type === 'charm_pop') {
      const notes = type === 'charm_pop' ? [587.33, 880] : [523.25, 783.99];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.045);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
        gain.gain.linearRampToValueAtTime(0.045, now + idx * 0.045 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.15);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'laser') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'shatter') {
      const freqs = [660, 880, 1174];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.025);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.025);
        gain.gain.linearRampToValueAtTime(0.036, now + idx * 0.025 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.025 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.025);
        osc.stop(now + idx * 0.025 + 0.13);
      });
    } else if (type === 'block_place') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'line_clear' || type === 'claim') {
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.2);
      });
    } else if (type === 'victory') {
      const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.065);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.065);
        gain.gain.linearRampToValueAtTime(0.042, now + idx * 0.065 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.065);
        osc.stop(now + idx * 0.065 + 0.27);
      });
    }
  } catch {
    // ignore Web Audio failure
  }
}
