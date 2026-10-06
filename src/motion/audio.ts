/**
 * One synthesised voice for the whole app.
 *
 * No audio file ships: the hum and chime are oscillators, and the micro tick is
 * a 30 ms sine blip. Nothing to download, nothing to licence. The timeline and
 * the micro-interaction layer share this module so there is exactly one
 * AudioContext per page, which is what mobile browsers reward anyway.
 *
 * Sound is opt-in: `setEnabled` mirrors the Settings toggle, and every method
 * is a no-op while disabled or before the first user gesture (the browser
 * blocks autoplayed contexts regardless).
 */

export type SoundKind = 'tick' | 'pop' | 'chime';

class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private enabled = true;

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.stopHum();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  /** A low filtered hum that swells in and fades — the Cold Open bed. */
  startHum(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    void ctx.resume().catch(() => undefined);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 6;

    osc.connect(filter);
    filter.connect(this.master);
    osc.start();
    this.hum = osc;

    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.exponentialRampToValueAtTime(0.06, now + 1.4);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);
  }

  private stopHum(): void {
    try {
      this.hum?.stop();
    } catch {
      /* already stopped */
    }
    this.hum = null;
  }

  /** Two notes, an octave apart, with a bell decay. Match and reveal moments. */
  chime(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + index * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.06 + 1.1);
      osc.connect(gain);
      gain.connect(this.master as GainNode);
      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 1.2);
    });
  }

  /** A very short soft blip — the confirmation under a micro-interaction. */
  blip(kind: SoundKind = 'tick'): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const freq = kind === 'tick' ? 1760 : kind === 'pop' ? 1320 : 880;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.05 : 0.08, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  destroy(): void {
    this.stopHum();
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0.0001, now);
    }
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
  }
}

/** Shared by the Cold Open, the mutual-match moment and every micro tick. */
export const synth = new Synth();
