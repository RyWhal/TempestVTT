import { useAudioStore } from '../stores/audioStore';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play synthesized physical dice roll sound (clattering dice tumbling on wood/felt surface).
 */
export function playDiceRollSound(): void {
  if (useAudioStore.getState().isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bounceDelays = [0, 0.04, 0.09, 0.15, 0.22, 0.30];

  bounceDelays.forEach((delay, index) => {
    const t = now + delay;
    const decay = Math.pow(0.55, index);

    // 1. Percussive noise burst (dice edge impact)
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600 - index * 60 + Math.random() * 80, t);
    filter.Q.setValueAtTime(4.0, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35 * decay, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(t);

    // 2. Low-frequency resonant thud for larger dice mass
    if (index < 3) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 - index * 20, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

      oscGain.gain.setValueAtTime(0.25 * decay, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
    }
  });
}

/**
 * Play synthesized location ping sound (resonant sonar radar ping).
 */
export function playPingSound(): void {
  if (useAudioStore.getState().isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;

  // Primary sonar pulse tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(950, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.03);

  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.6);

  // Secondary high harmonic echo
  const harmonicOsc = ctx.createOscillator();
  const harmonicGain = ctx.createGain();

  harmonicOsc.type = 'sine';
  harmonicOsc.frequency.setValueAtTime(1760, t);

  harmonicGain.gain.setValueAtTime(0.12, t);
  harmonicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

  harmonicOsc.connect(harmonicGain);
  harmonicGain.connect(ctx.destination);

  harmonicOsc.start(t);
  harmonicOsc.stop(t + 0.4);
}
