// Procedural Focus & Ambient Sound Engine using Web Audio API
// 100% self-contained, offline-compatible, no external CORS or streaming dependencies.

export type LofiStationId =
  | 'lofi-beats'
  | 'rain'
  | 'cafe'
  | 'ocean'
  | 'fireplace'
  | 'binaural'
  | 'whitenoise';

export interface LofiStation {
  id: LofiStationId;
  name: string;
  tagline: string;
  icon: string;
  bpm?: number;
}

export const LOFI_STATIONS: LofiStation[] = [
  {
    id: 'binaural',
    name: 'Sóng não 40Hz',
    tagline: 'Tần số Gamma 40Hz tăng cường tập trung sâu',
    icon: '🧠'
  },
  {
    id: 'lofi-beats',
    name: 'Giai điệu Lofi',
    tagline: 'Hợp âm Rhodes êm dịu & nhịp trống chill 76 BPM',
    icon: '🎵',
    bpm: 76
  },
  {
    id: 'rain',
    name: 'Mưa rào',
    tagline: 'Tiếng mưa rơi rào rạt & hạt mưa gõ cửa sổ',
    icon: '🌧️'
  },
  {
    id: 'whitenoise',
    name: 'Tiếng ồn trắng',
    tagline: 'Âm thanh nhiễu trắng cân bằng giúp cách ly tạp âm',
    icon: '🎧'
  },
  {
    id: 'ocean',
    name: 'Sóng biển',
    tagline: 'Tiếng sóng biển vỗ bờ dạt dào theo từng nhịp',
    icon: '🌊'
  },
  {
    id: 'cafe',
    name: 'Quán cà phê',
    tagline: 'Không gian quán cà phê ấm áp, tiếng tách sứ & trò chuyện khẽ',
    icon: '☕'
  },
  {
    id: 'fireplace',
    name: 'Lò sưởi',
    tagline: 'Lửa tí tách ấm áp, thư giãn tinh thần',
    icon: '🔥'
  }
];

class LofiAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isRunning: boolean = false;
  private currentStationId: LofiStationId = 'lofi-beats';
  private timerIds: number[] = [];
  private scheduledStopFns: Array<() => void> = [];
  private volume: number = 0.7;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.03);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getStation(): LofiStationId {
    return this.currentStationId;
  }

  public isPlaying(): boolean {
    return this.isRunning;
  }

  public play(stationId?: LofiStationId) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (stationId) {
      this.currentStationId = stationId;
    }

    this.stopAudioNodes();
    this.isRunning = true;
    this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);

    switch (this.currentStationId) {
      case 'binaural':
        this.startBinaural40Hz();
        break;
      case 'lofi-beats':
        this.startLofiBeats();
        break;
      case 'rain':
        this.startRainSound();
        break;
      case 'whitenoise':
        this.startWhiteNoise();
        break;
      case 'ocean':
        this.startOceanSound();
        break;
      case 'cafe':
        this.startCafeSound();
        break;
      case 'fireplace':
        this.startFireplaceSound();
        break;
    }
  }

  public pause() {
    this.isRunning = false;
    this.stopAudioNodes();
  }

  public stop() {
    this.pause();
  }

  public switchStation(stationId: LofiStationId) {
    this.currentStationId = stationId;
    if (this.isRunning) {
      this.play(stationId);
    }
  }

  private registerInterval(fn: () => void, ms: number) {
    const id = window.setInterval(fn, ms);
    this.timerIds.push(id);
    return id;
  }

  private stopAudioNodes() {
    this.timerIds.forEach((id) => clearInterval(id));
    this.timerIds = [];
    this.scheduledStopFns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    this.scheduledStopFns = [];
  }

  private createPinkNoiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * seconds);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return noiseBuffer;
  }

  private createWhiteNoiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * seconds);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.35;
    }
    return noiseBuffer;
  }

  // --- 1. Sóng não 40Hz (True Stereo 40Hz Gamma Binaural Beat + Soft Carrier Pad) ---
  private startBinaural40Hz() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;
    const now = ctx.currentTime;

    // Left ear: 200Hz, Right ear: 240Hz => 40Hz Gamma focus beat
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(200, now);
    oscR.frequency.setValueAtTime(240, now);

    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    panL.pan.setValueAtTime(-0.9, now);
    panR.pan.setValueAtTime(0.9, now);

    const binauralGain = ctx.createGain();
    binauralGain.gain.setValueAtTime(0.001, now);
    binauralGain.gain.linearRampToValueAtTime(0.22, now + 0.6);

    oscL.connect(panL);
    oscR.connect(panR);
    panL.connect(binauralGain);
    panR.connect(binauralGain);
    binauralGain.connect(master);

    // Subtle 40Hz pulse modulation pad at 100Hz so speakers also carry gentle 40Hz focus rhythm
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(100, now);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.08, now);

    const lfo40 = ctx.createOscillator();
    lfo40.type = 'sine';
    lfo40.frequency.setValueAtTime(40, now);
    const lfo40Depth = ctx.createGain();
    lfo40Depth.gain.setValueAtTime(0.03, now);
    lfo40.connect(lfo40Depth);
    lfo40Depth.connect(subGain.gain);

    subOsc.connect(subGain);
    subGain.connect(master);

    oscL.start(now);
    oscR.start(now);
    subOsc.start(now);
    lfo40.start(now);

    this.scheduledStopFns.push(() => {
      try {
        oscL.stop();
        oscR.stop();
        subOsc.stop();
        lfo40.stop();
      } catch {}
    });
  }

  // --- 2. Giai điệu Lofi (Warm Rhodes Chords + Soft Groove Drums + Vinyl Texture) ---
  private startLofiBeats() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    // Gentle vinyl crackle
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const click = Math.random() < 0.0015 ? (Math.random() - 0.5) * 3 : 0;
      output[i] = (white * 0.03 + click * 0.25) * 0.25;
    }

    const crackle = ctx.createBufferSource();
    crackle.buffer = noiseBuffer;
    crackle.loop = true;

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.value = 1900;
    crackleFilter.Q.value = 1.0;

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.14;

    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(master);
    crackle.start();

    this.scheduledStopFns.push(() => {
      try {
        crackle.stop();
      } catch {}
    });

    // Progression: Dm9 -> G13 -> Cmaj9 -> Am9
    const chords = [
      { bass: 146.83, notes: [220.0, 261.63, 329.63, 392.0, 493.88] },
      { bass: 98.0, notes: [196.0, 246.94, 329.63, 392.0, 440.0] },
      { bass: 130.81, notes: [164.81, 246.94, 293.66, 392.0, 493.88] },
      { bass: 110.0, notes: [196.0, 261.63, 329.63, 440.0, 493.88] }
    ];

    const triggerKick = (time: number) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
      gain.gain.setValueAtTime(0.32, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(time);
      osc.stop(time + 0.32);
    };

    const triggerSnare = (time: number) => {
      if (!this.ctx || !this.masterGain) return;
      const buf = this.createWhiteNoiseBuffer(0.14);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, time);
      filter.Q.value = 0.9;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(time);
      src.stop(time + 0.13);
    };

    const triggerHat = (time: number, accent: boolean) => {
      if (!this.ctx || !this.masterGain) return;
      const buf = this.createWhiteNoiseBuffer(0.05);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6500, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(accent ? 0.05 : 0.025, time);
      gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.045);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(time);
      src.stop(time + 0.05);
    };

    // 76 BPM -> 1 eighth note ~ 395ms; 8 eighth notes per chord bar (~3.16s)
    const stepMs = 395;
    let step = 0;

    const tick = () => {
      if (!this.isRunning || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const barStep = step % 8;
      const chordIdx = Math.floor(step / 8) % chords.length;
      const chord = chords[chordIdx];

      // Play Rhodes chord & bass at start of each bar
      if (barStep === 0) {
        chord.notes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const oscHarm = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          oscHarm.type = 'triangle';
          const detune = (Math.random() - 0.5) * 4;
          const startAt = now + idx * 0.035;
          osc.frequency.setValueAtTime(freq + detune, startAt);
          oscHarm.frequency.setValueAtTime((freq + detune) * 2, startAt);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1150, startAt);

          const oscHarmGain = this.ctx.createGain();
          oscHarmGain.gain.setValueAtTime(0.18, startAt);

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.linearRampToValueAtTime(0.08, startAt + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, startAt + 2.9);

          osc.connect(filter);
          oscHarm.connect(oscHarmGain);
          oscHarmGain.connect(filter);
          filter.connect(gain);
          gain.connect(master);

          osc.start(startAt);
          oscHarm.start(startAt);
          osc.stop(startAt + 3.0);
          oscHarm.stop(startAt + 3.0);
        });

        // Warm sub-bass note
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(chord.bass, now);
        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.16, now + 0.05);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
        bassOsc.connect(bassGain);
        bassGain.connect(master);
        bassOsc.start(now);
        bassOsc.stop(now + 2.9);
      }

      // Drum groove
      if (barStep === 0 || barStep === 5) triggerKick(now);
      if (barStep === 2 || barStep === 6) triggerSnare(now);
      triggerHat(now, barStep % 2 === 0);

      step++;
    };

    tick();
    this.registerInterval(tick, stepMs);
  }

  // --- 3. Mưa rào (Rich Pink Rain Bed + Organic Raindrop Patter) ---
  private startRainSound() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    const rainBuffer = this.createPinkNoiseBuffer(4);
    if (!rainBuffer) return;

    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = rainBuffer;
    rainSrc.loop = true;

    // Warm rain body filter
    const rainLowpass = ctx.createBiquadFilter();
    rainLowpass.type = 'lowpass';
    rainLowpass.frequency.setValueAtTime(2200, ctx.currentTime);

    const rainHighpass = ctx.createBiquadFilter();
    rainHighpass.type = 'highpass';
    rainHighpass.frequency.setValueAtTime(180, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.58, ctx.currentTime);

    // Subtle rain gust swell
    const gustLfo = ctx.createOscillator();
    gustLfo.frequency.value = 0.11;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.12;
    gustLfo.connect(gustDepth);
    gustDepth.connect(rainGain.gain);

    rainSrc.connect(rainHighpass);
    rainHighpass.connect(rainLowpass);
    rainLowpass.connect(rainGain);
    rainGain.connect(master);

    rainSrc.start();
    gustLfo.start();

    this.scheduledStopFns.push(() => {
      try {
        rainSrc.stop();
        gustLfo.stop();
      } catch {}
    });

    // Organic raindrop patters
    const triggerDrops = () => {
      if (!this.isRunning || !this.ctx || !this.masterGain) return;
      const dropCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < dropCount; i++) {
        const delay = Math.random() * 0.22;
        const startAt = this.ctx.currentTime + delay;
        const buf = this.createWhiteNoiseBuffer(0.035);
        if (!buf) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1800 + Math.random() * 2400, startAt);
        bp.Q.setValueAtTime(3.2, startAt);

        const pan = this.ctx.createStereoPanner();
        pan.pan.setValueAtTime((Math.random() - 0.5) * 1.4, startAt);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06 + Math.random() * 0.08, startAt);
        g.gain.exponentialRampToValueAtTime(0.0005, startAt + 0.03);

        src.connect(bp);
        bp.connect(pan);
        pan.connect(g);
        g.connect(master);

        src.start(startAt);
        src.stop(startAt + 0.035);
      }
    };

    this.registerInterval(triggerDrops, 240);
  }

  // --- 4. Tiếng ồn trắng (Smooth Balanced Studio White Noise) ---
  private startWhiteNoise() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    const bufferL = this.createWhiteNoiseBuffer(3);
    const bufferR = this.createWhiteNoiseBuffer(3);
    if (!bufferL || !bufferR) return;

    const srcL = ctx.createBufferSource();
    const srcR = ctx.createBufferSource();
    srcL.buffer = bufferL;
    srcR.buffer = bufferR;
    srcL.loop = true;
    srcR.loop = true;

    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    panL.pan.value = -0.65;
    panR.pan.value = 0.65;

    // Gentle shaping so white noise is crisp and comforting without piercing high frequencies
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(100, ctx.currentTime);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4800, ctx.currentTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.4);

    srcL.connect(panL);
    srcR.connect(panR);
    panL.connect(hp);
    panR.connect(hp);
    hp.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(master);

    srcL.start();
    srcR.start();

    this.scheduledStopFns.push(() => {
      try {
        srcL.stop();
        srcR.stop();
      } catch {}
    });
  }

  // --- 5. Sóng biển (Rolling Ocean Surf Waves Swelling & Receding) ---
  private startOceanSound() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    const surfBuffer = this.createPinkNoiseBuffer(5);
    if (!surfBuffer) return;

    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = surfBuffer;
    surfSrc.loop = true;

    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.setValueAtTime(480, ctx.currentTime);
    surfFilter.Q.value = 0.7;

    const surfGain = ctx.createGain();
    surfGain.gain.setValueAtTime(0.35, ctx.currentTime);

    // Slow rhythmic wave swell every ~7.5 seconds (both filter cutoff & volume rise and fall together)
    const waveLfo = ctx.createOscillator();
    waveLfo.type = 'sine';
    waveLfo.frequency.setValueAtTime(1 / 7.5, ctx.currentTime);

    const filterDepth = ctx.createGain();
    filterDepth.gain.setValueAtTime(380, ctx.currentTime); // sweeps 100Hz <-> 860Hz

    const ampDepth = ctx.createGain();
    ampDepth.gain.setValueAtTime(0.28, ctx.currentTime); // sweeps 0.07 <-> 0.63

    waveLfo.connect(filterDepth);
    filterDepth.connect(surfFilter.frequency);

    waveLfo.connect(ampDepth);
    ampDepth.connect(surfGain.gain);

    surfSrc.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(master);

    // Secondary foamy shore wash layer (slightly offset phase)
    const foamBuffer = this.createPinkNoiseBuffer(4);
    let foamSrc: AudioBufferSourceNode | null = null;
    let foamLfo: OscillatorNode | null = null;
    if (foamBuffer) {
      foamSrc = ctx.createBufferSource();
      foamSrc.buffer = foamBuffer;
      foamSrc.loop = true;

      const foamBp = ctx.createBiquadFilter();
      foamBp.type = 'bandpass';
      foamBp.frequency.setValueAtTime(1400, ctx.currentTime);
      foamBp.Q.value = 0.8;

      const foamGain = ctx.createGain();
      foamGain.gain.setValueAtTime(0.14, ctx.currentTime);

      foamLfo = ctx.createOscillator();
      foamLfo.type = 'sine';
      foamLfo.frequency.setValueAtTime(1 / 7.5, ctx.currentTime);
      const foamAmpDepth = ctx.createGain();
      foamAmpDepth.gain.setValueAtTime(0.13, ctx.currentTime);
      foamLfo.connect(foamAmpDepth);
      foamAmpDepth.connect(foamGain.gain);

      foamSrc.connect(foamBp);
      foamBp.connect(foamGain);
      foamGain.connect(master);

      foamSrc.start();
      foamLfo.start();
    }

    surfSrc.start();
    waveLfo.start();

    this.scheduledStopFns.push(() => {
      try {
        surfSrc.stop();
        waveLfo.stop();
        foamSrc?.stop();
        foamLfo?.stop();
      } catch {}
    });
  }

  // --- 6. Quán cà phê (Warm Cafe Murmur + Porcelain Cup Clinks + Soft Cafe Chords) ---
  private startCafeSound() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    // Warm indoor room murmur (low-mid filtered pink noise with gentle chatter modulation)
    const murmurBuf = this.createPinkNoiseBuffer(4);
    if (!murmurBuf) return;

    const murmurSrc = ctx.createBufferSource();
    murmurSrc.buffer = murmurBuf;
    murmurSrc.loop = true;

    const murmurBp = ctx.createBiquadFilter();
    murmurBp.type = 'bandpass';
    murmurBp.frequency.setValueAtTime(520, ctx.currentTime);
    murmurBp.Q.value = 0.65;

    const murmurGain = ctx.createGain();
    murmurGain.gain.setValueAtTime(0.42, ctx.currentTime);

    // Subtle organic voice-like cadence modulation
    const chatterLfo = ctx.createOscillator();
    chatterLfo.frequency.value = 1.8;
    const chatterDepth = ctx.createGain();
    chatterDepth.gain.value = 0.08;
    chatterLfo.connect(chatterDepth);
    chatterDepth.connect(murmurGain.gain);

    murmurSrc.connect(murmurBp);
    murmurBp.connect(murmurGain);
    murmurGain.connect(master);

    murmurSrc.start();
    chatterLfo.start();

    this.scheduledStopFns.push(() => {
      try {
        murmurSrc.stop();
        chatterLfo.stop();
      } catch {}
    });

    // Realistic ceramic cup & saucer clink (short impulse noise + muted ceramic resonance)
    const triggerCupClink = () => {
      if (!this.isRunning || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // Short ceramic transient
      const buf = this.createWhiteNoiseBuffer(0.045);
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2900 + Math.random() * 900, now);
        bp.Q.setValueAtTime(8.5, now);

        const pan = this.ctx.createStereoPanner();
        pan.pan.setValueAtTime((Math.random() - 0.5) * 1.2, now);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.045);

        src.connect(bp);
        bp.connect(pan);
        pan.connect(g);
        g.connect(master);

        src.start(now);
        src.stop(now + 0.05);
      }

      // Soft warm acoustic café chord occasionally
      if (Math.random() < 0.6) {
        const cafeChords = [
          [261.63, 329.63, 392.0, 493.88],
          [220.0, 261.63, 329.63, 392.0],
          [196.0, 246.94, 293.66, 392.0]
        ];
        const chosen = cafeChords[Math.floor(Math.random() * cafeChords.length)];
        chosen.forEach((f, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const lp = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          const t = now + 0.1 + idx * 0.05;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(750, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.032, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
          osc.connect(lp);
          lp.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 1.9);
        });
      }
    };

    // Occasional soft espresso machine steam hiss
    const triggerEspressoSteam = () => {
      if (!this.isRunning || !this.ctx || !this.masterGain) return;
      if (Math.random() > 0.45) return;
      const now = this.ctx.currentTime;
      const buf = this.createWhiteNoiseBuffer(0.9);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3400, now);
      bp.Q.value = 1.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.85);

      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(now);
      src.stop(now + 0.9);
    };

    triggerCupClink();
    this.registerInterval(triggerCupClink, 3200);
    this.registerInterval(triggerEspressoSteam, 5500);
  }

  // --- 7. Lò sưởi (Warm Hearth Rumble & Crisp Wood Crackles) ---
  private startFireplaceSound() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    const fireBuf = this.createPinkNoiseBuffer(3);
    if (!fireBuf) return;

    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = fireBuf;
    fireSrc.loop = true;

    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 280;

    const fireGain = ctx.createGain();
    fireGain.gain.value = 0.5;

    fireSrc.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(master);
    fireSrc.start();

    this.scheduledStopFns.push(() => {
      try {
        fireSrc.stop();
      } catch {}
    });

    const triggerCrackle = () => {
      if (!this.isRunning || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const buf = this.createWhiteNoiseBuffer(0.03);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(1400 + Math.random() * 1800, now);
      hp.Q.value = 2.5;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.03);

      src.connect(hp);
      hp.connect(g);
      g.connect(master);
      src.start(now);
      src.stop(now + 0.035);
    };

    this.registerInterval(triggerCrackle, 380);
  }
}

export const lofiEngine = new LofiAudioEngine();
