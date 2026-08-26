export type SoundEffect = 'click' | 'merge' | 'chain' | 'spawn' | 'undo' | 'success' | 'game-over';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

export function playSound(effect: SoundEffect, enabled: boolean): void {
  if (!enabled) return;
  const context = getAudioContext();
  if (!context) return;
  const frequencies: Record<SoundEffect, number[]> = { click: [440], merge: [523, 659], chain: [523, 659, 784], spawn: [330], undo: [392, 294], success: [523, 659, 784, 1047], 'game-over': [294, 220] };
  const duration = effect === 'success' ? 0.42 : effect === 'chain' ? 0.28 : 0.14;
  const start = context.currentTime;
  frequencies[effect].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = effect === 'merge' || effect === 'chain' ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + index * 0.055);
    gain.gain.exponentialRampToValueAtTime(0.07, start + index * 0.055 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.055 + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + index * 0.055);
    oscillator.stop(start + index * 0.055 + duration + 0.02);
  });
}

export function vibrate(enabled: boolean, pattern: number | number[] = 12): void {
  if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
