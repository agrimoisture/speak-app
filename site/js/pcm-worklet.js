class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(0);
    this.frac = 0;
    this.batch = new Int16Array(640);
    this.batchLen = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;
    const merged = new Float32Array(this.pending.length + channel.length);
    merged.set(this.pending, 0);
    merged.set(channel, this.pending.length);
    const step = sampleRate / 16000;
    let pos = this.frac;
    while (pos + 1 < merged.length) {
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      let sample = merged[i0] * (1 - frac) + merged[i0 + 1] * frac;
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      this.batch[this.batchLen] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.batchLen += 1;
      if (this.batchLen === this.batch.length) {
        const out = this.batch;
        this.port.postMessage(out, [out.buffer]);
        this.batch = new Int16Array(640);
        this.batchLen = 0;
      }
      pos += step;
    }
    const keepFrom = Math.floor(pos);
    this.frac = pos - keepFrom;
    this.pending = merged.slice(Math.min(keepFrom, merged.length));
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
