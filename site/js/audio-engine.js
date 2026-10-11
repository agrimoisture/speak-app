import { base64ToPcm16, downsampleToPcm16 } from "./pcm.js";

const CHUNK = 640;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.captureNode = null;
    this.mute = null;
    this.source = null;
    this.onPcm = null;
    this.pending = new Int16Array(0);
    this.sources = [];
    this.queueTime = 0;
    this.playGen = 0;
    this.onPlaybackIdle = null;
  }

  /** Call synchronously inside a tap so iOS unlocks audio and the mic together. */
  beginGesture() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return {
        resumePromise: Promise.reject(Object.assign(new Error("no audio"), { name: "NotSupportedError" })),
        micPromise: Promise.reject(Object.assign(new Error("no audio"), { name: "NotSupportedError" })),
      };
    }
    if (!this.ctx) this.ctx = new AudioCtx();
    const resumePromise = this.ctx.state === "suspended" ? this.ctx.resume() : Promise.resolve();
    const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const silent = this.ctx.createBufferSource();
    silent.buffer = buffer;
    silent.connect(this.ctx.destination);
    silent.start();
    const micPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return { resumePromise, micPromise };
  }

  async unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async attachStream(stream, onPcm) {
    this.stream = stream;
    this.onPcm = onPcm;
    this.source = this.ctx.createMediaStreamSource(stream);
    try {
      await this.ctx.audioWorklet.addModule(new URL("./pcm-worklet.js", import.meta.url));
      const node = new AudioWorkletNode(this.ctx, "pcm-capture");
      node.port.onmessage = (event) => this._emit(event.data);
      this.source.connect(node);
      this.mute = this.ctx.createGain();
      this.mute.gain.value = 0;
      node.connect(this.mute);
      this.mute.connect(this.ctx.destination);
      this.captureNode = node;
    } catch {
      this._startScriptProcessor();
    }
  }

  enqueue(base64, sampleRate = 24000) {
    if (!this.ctx || !base64) return;
    const pcm = base64ToPcm16(base64);
    if (!pcm.length) return;
    const audioBuffer = this.ctx.createBuffer(1, pcm.length, sampleRate);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    if (this.queueTime < now + 0.04) this.queueTime = now + 0.04;
    const gen = this.playGen;
    source.start(this.queueTime);
    this.queueTime += audioBuffer.duration;
    this.sources.push(source);
    source.onended = () => {
      if (gen !== this.playGen) return;
      this.sources = this.sources.filter((item) => item !== source);
      if (this.sources.length === 0) this.onPlaybackIdle?.();
    };
  }

  isPlaying() {
    return this.sources.length > 0;
  }

  stopPlayback() {
    this.playGen += 1;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.queueTime = 0;
  }

  stopMic() {
    this.onPcm = null;
    try {
      this.captureNode?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.mute?.disconnect();
    } catch {
      /* ignore */
    }
    this.captureNode = null;
    this.source = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;
    this.pending = new Int16Array(0);
  }

  async close() {
    this.stopMic();
    this.stopPlayback();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }

  _startScriptProcessor() {
    const processor = this.ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = downsampleToPcm16(input, this.ctx.sampleRate, 16000);
      this._emit(pcm);
    };
    this.source.connect(processor);
    this.mute = this.ctx.createGain();
    this.mute.gain.value = 0;
    processor.connect(this.mute);
    this.mute.connect(this.ctx.destination);
    this.captureNode = processor;
  }

  _emit(int16) {
    if (!int16?.length || !this.onPcm) return;
    const merged = new Int16Array(this.pending.length + int16.length);
    merged.set(this.pending, 0);
    merged.set(int16, this.pending.length);
    let offset = 0;
    while (merged.length - offset >= CHUNK) {
      this.onPcm(merged.subarray(offset, offset + CHUNK));
      offset += CHUNK;
    }
    this.pending = merged.slice(offset);
  }
}
