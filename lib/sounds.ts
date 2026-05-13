export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {}
}

export function playCaChing(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // "Ca" — short metallic noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 6);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 5000; nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
    noise.start(now); noise.stop(now + 0.07);

    // "Ching" — bell tone
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.55);
    og.gain.setValueAtTime(0.28, now + 0.06);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(now + 0.06); osc.stop(now + 0.65);
    osc.onended = () => ctx.close();
  } catch {}
}
