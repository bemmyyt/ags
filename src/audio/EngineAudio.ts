export class EngineAudio {
  private context?: AudioContext;
  private oscillator?: OscillatorNode;
  private gain?: GainNode;
  enabled = true;
  start() {
    if (this.context) return;
    this.context = new AudioContext(); this.oscillator = this.context.createOscillator(); this.gain = this.context.createGain();
    this.oscillator.type = 'sawtooth'; this.gain.gain.value = 0.0001; this.oscillator.connect(this.gain).connect(this.context.destination); this.oscillator.start();
  }
  update(rpm: number, drifting: boolean) {
    if (!this.context || !this.oscillator || !this.gain) return;
    const now = this.context.currentTime; this.oscillator.frequency.setTargetAtTime(32 + rpm / 46, now, 0.045);
    this.gain.gain.setTargetAtTime(this.enabled ? 0.016 + (drifting ? 0.012 : 0) : 0.0001, now, 0.05);
  }
  toggle() { this.enabled = !this.enabled; }
}
