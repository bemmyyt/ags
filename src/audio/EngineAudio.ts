/**
 * A lightweight procedural vehicle mix. It deliberately uses generated nodes rather
 * than external samples so the game remains self-contained and license-safe.
 */
export class EngineAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineGain?: GainNode;
  private subGain?: GainNode;
  private tireFilter?: BiquadFilterNode;
  private tireGain?: GainNode;
  private windFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  private paused = false;
  private documentHidden = false;
  enabled = true;

  constructor() {
    window.addEventListener('open-road:pause', (event) => {
      this.paused = this.detail(event) === 'paused';
      this.updateMaster();
    });
    window.addEventListener('open-road:ui-confirm', () => this.uiConfirm());
    window.addEventListener('open-road:countdown', (event) => this.countdown(this.detail(event)));
    window.addEventListener('open-road:race-result', (event) => this.raceResult(this.detail(event)));
    document.addEventListener('visibilitychange', () => {
      this.documentHidden = document.hidden;
      if (!document.hidden && this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
      this.updateMaster();
    });
  }

  start() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return;
    }

    const context = new AudioContext();
    this.context = context;
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -19;
    compressor.knee.value = 18;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;
    master.gain.value = 0.0001;
    master.connect(compressor).connect(context.destination);
    this.master = master;

    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 620;
    engineFilter.Q.value = 0.75;
    const engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    engineFilter.connect(engineGain).connect(master);
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;

    const primary = context.createOscillator();
    primary.type = 'sawtooth';
    primary.frequency.value = 50;
    const harmonic = context.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = 100;
    const harmonicGain = context.createGain();
    harmonicGain.gain.value = 0.42;
    primary.connect(engineFilter);
    harmonic.connect(harmonicGain).connect(engineFilter);
    primary.start();
    harmonic.start();
    this.primary = primary;
    this.harmonic = harmonic;

    const sub = context.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 49;
    const subGain = context.createGain();
    subGain.gain.value = 0.0001;
    sub.connect(subGain).connect(master);
    sub.start();
    this.sub = sub;
    this.subGain = subGain;

    const tireFilter = context.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.value = 1550;
    tireFilter.Q.value = 1.2;
    const tireGain = context.createGain();
    tireGain.gain.value = 0.0001;
    tireFilter.connect(tireGain).connect(master);
    this.noiseSource(context).connect(tireFilter);
    this.tireFilter = tireFilter;
    this.tireGain = tireGain;

    // A separate, low-key wind layer makes real highway velocity audible without
    // turning the engine mix into a constant hiss at town speeds.
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 540;
    windFilter.Q.value = 0.55;
    const windGain = context.createGain();
    windGain.gain.value = 0.0001;
    windFilter.connect(windGain).connect(master);
    this.noiseSource(context).connect(windFilter);
    this.windFilter = windFilter;
    this.windGain = windGain;

    void context.resume().catch(() => undefined);
    this.updateMaster();
  }

  update(rpm: number, drifting: boolean, speedKph = 0) {
    const context = this.context;
    if (!context || !this.engineFilter || !this.engineGain || !this.subGain || !this.tireFilter || !this.tireGain || !this.windFilter || !this.windGain) return;
    const normalizedRpm = Math.min(1, Math.max(0, (rpm - 850) / 6350));
    const firingFrequency = 28 + rpm / 42;
    const highway = Math.min(1, Math.max(0, (speedKph - 38) / 175));

    // The nodes are found through the graph only once, so frequency updates are
    // intentionally kept on the source oscillators' parameters via saved aliases.
    this.setOscillatorFrequencies(firingFrequency);
    this.smooth(this.engineFilter.frequency, 340 + normalizedRpm * 2850, 0.055);
    this.smooth(this.engineFilter.Q, 0.72 + normalizedRpm * 1.25, 0.08);
    this.smooth(this.engineGain.gain, 0.035 + normalizedRpm * 0.075, 0.06);
    this.smooth(this.subGain.gain, 0.014 + (1 - normalizedRpm) * 0.024, 0.08);
    this.smooth(this.tireFilter.frequency, 1050 + normalizedRpm * 1850, 0.055);
    const roadNoise = highway * 0.014;
    this.smooth(this.tireGain.gain, drifting ? 0.025 + normalizedRpm * 0.055 : roadNoise + 0.0001, drifting ? 0.035 : 0.12);
    this.smooth(this.windFilter.frequency, 430 + highway * 980, 0.12);
    this.smooth(this.windGain.gain, 0.0001 + highway * highway * 0.042, 0.16);
    this.updateMaster();
  }

  toggle() { this.enabled = !this.enabled; this.updateMaster(); }

  /** Available to future collision wiring without forcing a dependency on physics. */
  impact(intensity = 0.5) {
    const context = this.context;
    if (!context || !this.master || !this.enabled || this.paused || this.documentHidden) return;
    const now = context.currentTime;
    const hit = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    hit.type = 'triangle';
    hit.frequency.setValueAtTime(115 + Math.min(1, Math.max(0, intensity)) * 100, now);
    hit.frequency.exponentialRampToValueAtTime(42, now + 0.13);
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1 * Math.min(1, Math.max(0.2, intensity)), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    hit.connect(filter).connect(gain).connect(this.master);
    hit.start(now);
    hit.stop(now + 0.18);
  }

  private primary?: OscillatorNode;
  private harmonic?: OscillatorNode;
  private sub?: OscillatorNode;

  private setOscillatorFrequencies(firingFrequency: number) {
    // `start` creates persistent tones; retaining these node references keeps
    // update allocation-free while allowing smooth RPM tracking.
    if (!this.primary || !this.harmonic || !this.sub) return;
    this.smooth(this.primary.frequency, firingFrequency, 0.045);
    this.smooth(this.harmonic.frequency, firingFrequency * 2.01, 0.04);
    this.smooth(this.sub.frequency, Math.max(31, firingFrequency * 0.52), 0.07);
  }

  private noiseSource(context: AudioContext) {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      samples[index] = previous;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    return source;
  }

  private updateMaster() {
    if (!this.context || !this.master) return;
    const slider = document.getElementById('master-volume');
    const volume = slider instanceof HTMLInputElement ? Number(slider.value) / 100 : 0.7;
    const audible = this.enabled && !this.paused && !this.documentHidden;
    this.smooth(this.master.gain, audible ? Math.min(1, Math.max(0, volume)) * 0.48 : 0.0001, audible ? 0.075 : 0.045);
  }

  private smooth(parameter: AudioParam, value: number, timeConstant: number) {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(value, now, timeConstant);
  }

  private uiConfirm() { this.tone(620, 0.055, 0.028, 'triangle'); }

  private countdown(value: string) {
    if (value === 'GO!') this.tone(880, 0.16, 0.055, 'square');
    else this.tone(420, 0.08, 0.04, 'sine');
  }

  private raceResult(result: string) {
    if (result === 'win') {
      this.tone(660, 0.12, 0.05, 'triangle');
      window.setTimeout(() => this.tone(880, 0.18, 0.055, 'triangle'), 105);
    } else this.tone(170, 0.24, 0.042, 'sawtooth');
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType) {
    const context = this.context;
    if (!context || !this.master || !this.enabled || this.paused || this.documentHidden) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  private detail(event: Event) {
    return event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : '';
  }
}
