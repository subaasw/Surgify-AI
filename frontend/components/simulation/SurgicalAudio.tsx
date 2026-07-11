"use client";

import { useRef, useCallback } from "react";

// Helper to create a buffer of random noise
function createNoiseBuffer(ctx: AudioContext, duration: number, type: 'white' | 'brown' = 'white') {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else {
    // Brown noise approximation
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Compensate for gain
    }
  }
  
  return buffer;
}

export function useSurgicalAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const incisionOscRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is unavailable");
      ctxRef.current = new AudioContextClass();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playPierce = useCallback(() => {
    try {
      const ctx = getContext();
      const t = ctx.currentTime;
      
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 0.1, 'brown');
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 200;
      filter.Q.value = 1.5;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      source.start(t);
      source.stop(t + 0.1);
    } catch { /* audio feedback is optional */ }
  }, [getContext]);

  const playPull = useCallback(() => {
    try {
      const ctx = getContext();
      const t = ctx.currentTime;
      
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 0.5, 'white');
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(2000, t + 0.4);
      filter.Q.value = 2.0;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.1);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      source.start(t);
      source.stop(t + 0.5);
    } catch { /* audio feedback is optional */ }
  }, [getContext]);

  const playSnip = useCallback(() => {
    try {
      const ctx = getContext();
      const t = ctx.currentTime;
      
      // Metallic click (Sine)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4000, t);
      osc.frequency.exponentialRampToValueAtTime(1000, t + 0.015);
      
      // Snip friction (Noise)
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.03, 'white');
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
      
      osc.connect(gain);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.015);
      noise.start(t);
      noise.stop(t + 0.03);
    } catch { /* audio feedback is optional */ }
  }, [getContext]);

  const playKnot = useCallback(() => {
    try {
      const ctx = getContext();
      const t = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 150;
      
      // Tremolo effect for "tightening" sound
      const tremolo = ctx.createOscillator();
      tremolo.type = 'sine';
      tremolo.frequency.value = 20;
      
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 0.5; // Depth
      
      tremolo.connect(tremoloGain);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      
      // Apply tremolo to main gain
      tremoloGain.connect(gain.gain);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(t);
      tremolo.start(t);
      osc.stop(t + 0.2);
      tremolo.stop(t + 0.2);
    } catch { /* audio feedback is optional */ }
  }, [getContext]);

  const playIncision = useCallback(() => {
    try {
      const ctx = getContext();
      if (incisionOscRef.current) return; // Already playing
      
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 10, 'brown'); // 10s loop buffer
      source.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800; // mid-range
      filter.Q.value = 1.0;
      
      // Modulate filter for scraping texture
      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = 8; // 8Hz modulation
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 400; // Sweep range +-400Hz
      
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.1);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      source.start(t);
      lfo.start(t);
      
      incisionOscRef.current = { source, gain };
    } catch { /* audio feedback is optional */ }
  }, [getContext]);

  const stopIncision = useCallback(() => {
    if (incisionOscRef.current) {
      const ctx = getContext();
      const t = ctx.currentTime;
      
      incisionOscRef.current.gain.gain.linearRampToValueAtTime(0, t + 0.1);
      incisionOscRef.current.source.stop(t + 0.1);
      incisionOscRef.current = null;
    }
  }, [getContext]);

  return {
    playPierce,
    playPull,
    playSnip,
    playKnot,
    playIncision,
    stopIncision,
  };
}
