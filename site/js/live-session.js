import { pcm16ToBase64 } from "./pcm.js";
import {
  buildActivityEnd,
  buildActivityStart,
  buildAudioMessage,
  buildAudioStreamEnd,
  buildClientText,
  buildSetupMessage,
  buildWsUrl,
  continuationText,
  extractAudioParts,
  openingUserText,
  sampleRateFromMime,
  wrapUpUserText,
} from "./protocol.js";
import { createTranscriptState, reduceTranscript, snapshotLines } from "./transcript.js";
import { apiErrorMessage, redactSecrets, socketCloseMessage } from "./errors.js";

const MAX_PREROLL = 5600;
const MAX_RESUMES = 6;
const WRAP_MS = 12000;

export class LiveSession {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.systemText = options.systemText;
    this.mode = options.mode === "handsfree" ? "handsfree" : "tap";
    this.vocab = options.vocab || [];
    this.player = options.player || { enqueue() {}, stop() {} };
    this.onEvent = options.onEvent || (() => {});
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.ws = null;
    this.setupDone = false;
    this.intentionalClose = false;
    this.resuming = false;
    this.resumeAttempts = 0;
    this.resumeHandle = null;
    this.shouldGreet = true;
    this.shouldContinue = false;
    this.setupSent = false;
    this.skipNextTurnComplete = false;
    this.utteranceOpen = false;
    this.handsfreePaused = false;
    this.dropAudio = false;
    this.preroll = [];
    this.prerollSamples = 0;
    this.transcript = createTranscriptState();
    this.wrapUp = null;
    this.wrapTimer = 0;
    this.wrapStartCount = 0;
  }

  start() {
    this.shouldGreet = true;
    this.shouldContinue = false;
    this.onEvent({ type: "status", status: "connecting" });
    this._connect(null);
  }

  isReady() {
    return this.setupDone && this.ws?.readyState === 1;
  }

  getLines() {
    return snapshotLines(this.transcript);
  }

  pushPcm(int16) {
    if (!int16?.length || !this.setupDone || this.ws?.readyState !== 1) return;
    if (this.mode === "handsfree") {
      if (this.handsfreePaused) return;
      this._sendAudio(int16);
      return;
    }
    if (!this.utteranceOpen) {
      this._pushPreroll(int16);
      return;
    }
    this._sendAudio(int16);
  }

  beginUtterance() {
    if (this.mode !== "tap" || !this.isReady() || this.utteranceOpen) return false;
    this.player.stop();
    this.dropAudio = true;
    this._send(buildActivityStart());
    this.utteranceOpen = true;
    for (const chunk of this.preroll) this._sendAudio(chunk);
    this.preroll = [];
    this.prerollSamples = 0;
    return true;
  }

  endUtterance() {
    if (!this.utteranceOpen) return;
    this.utteranceOpen = false;
    this.dropAudio = false;
    this._send(buildActivityEnd());
  }

  pauseHandsfree() {
    this.handsfreePaused = true;
    if (this.mode === "handsfree" && this.isReady()) this._send(buildAudioStreamEnd());
  }

  resumeHandsfree() {
    this.handsfreePaused = false;
  }

  changeMode(mode) {
    const next = mode === "handsfree" ? "handsfree" : "tap";
    if (next === this.mode) return;
    this.endUtterance();
    this.mode = next;
    this.handsfreePaused = false;
    this.player.stop();
    this.dropAudio = true;
    if (!this.setupSent) return;
    const handle = this.setupDone ? this.resumeHandle : null;
    this.shouldGreet = this.setupDone ? false : this.shouldGreet;
    this.shouldContinue = Boolean(this.setupDone && !handle);
    this.intentionalClose = true;
    try {
      this.ws?.close();
    } catch {
      /* already closing */
    }
    this.intentionalClose = false;
    this.setupDone = false;
    this.setupSent = false;
    this.onEvent({ type: "status", status: "reconnecting" });
    this._connect(handle);
  }

  requestWrapUp() {
    if (!this.isReady()) return Promise.resolve("");
    if (this.wrapUp) return this.wrapUp.promise;
    this.endUtterance();
    let resolveWrap = () => {};
    const promise = new Promise((resolve) => {
      resolveWrap = resolve;
    });
    this.wrapStartCount = snapshotLines(this.transcript).length;
    this.skipNextTurnComplete = false;
    this.wrapUp = { promise, resolve: resolveWrap };
    this._send(buildClientText(wrapUpUserText()));
    this.wrapTimer = setTimeout(() => this._finishWrapUp(), WRAP_MS);
    return promise;
  }

  stop() {
    this.intentionalClose = true;
    this._finishWrapUp();
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
    this.setupDone = false;
  }

  _connect(handle) {
    const ws = new this.WebSocketImpl(buildWsUrl(this.apiKey));
    this.ws = ws;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.setupSent = true;
      this._send(
        buildSetupMessage({
          systemText: this.systemText,
          mode: this.mode,
          resumeHandle: handle,
          vocab: this.vocab,
        }),
      );
    };
    ws.onmessage = (event) => {
      if (ws !== this.ws) return;
      this._onRaw(event.data);
    };
    ws.onerror = () => {
      /* onclose reports the failure; the error event has no useful detail. */
    };
    ws.onclose = (event) => {
      if (ws !== this.ws || this.intentionalClose) return;
      this.setupDone = false;
      if (this.resumeHandle && this.resumeAttempts < MAX_RESUMES && !this.wrapUp) {
        this._resume();
        return;
      }
      this.onEvent({
        type: "closed",
        message: socketCloseMessage(event?.code, redactSecrets(event?.reason, this.apiKey)),
      });
    };
  }

  _resume() {
    if (this.resuming || !this.resumeHandle) return;
    this.resuming = true;
    this.resumeAttempts += 1;
    const handle = this.resumeHandle;
    this.shouldGreet = false;
    this.shouldContinue = false;
    this.intentionalClose = true;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.intentionalClose = false;
    this.setupDone = false;
    this.onEvent({ type: "status", status: "reconnecting" });
    this._connect(handle);
    this.resuming = false;
  }

  async _onRaw(data) {
    let raw = data;
    if (typeof raw !== "string") {
      if (typeof raw?.text === "function") raw = await raw.text();
      else return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    this._handle(message);
  }

  _handle(message) {
    if (message.error) {
      const status = message.error.code || message.error.status;
      this.onEvent({
        type: "error",
        message: apiErrorMessage(Number(status) || 0, JSON.stringify(message)),
      });
      return;
    }
    if (message.sessionResumptionUpdate?.newHandle && message.sessionResumptionUpdate.resumable !== false) {
      this.resumeHandle = message.sessionResumptionUpdate.newHandle;
    }
    if (Object.prototype.hasOwnProperty.call(message, "setupComplete")) {
      this.setupDone = true;
      this.preroll = [];
      this.prerollSamples = 0;
      this.onEvent({ type: "status", status: "ready" });
      if (this.shouldGreet) {
        this.shouldGreet = false;
        this._send(buildClientText(openingUserText()));
        this.onEvent({ type: "status", status: "opening" });
      } else if (this.shouldContinue) {
        this.shouldContinue = false;
        this._send(buildClientText(continuationText(snapshotLines(this.transcript))));
        this.onEvent({ type: "status", status: "opening" });
      }
    }
    if (message.serverContent?.interrupted) {
      this.dropAudio = true;
      this.skipNextTurnComplete = true;
      this.player.stop();
      this.onEvent({ type: "interrupted" });
    }
    if (message.serverContent) {
      this.transcript = reduceTranscript(this.transcript, message);
      this.onEvent({
        type: "transcript",
        lines: snapshotLines(this.transcript),
        partialUser: this.transcript.partialUser,
        partialModel: this.transcript.partialModel,
      });
    }
    if (!this.dropAudio) {
      for (const clip of extractAudioParts(message)) {
        this.player.enqueue(clip.data, sampleRateFromMime(clip.mime));
        this.onEvent({ type: "audio" });
      }
    }
    if (message.serverContent?.turnComplete) {
      const skipped = this.skipNextTurnComplete || message.serverContent.interrupted;
      this.skipNextTurnComplete = false;
      this.dropAudio = false;
      this.onEvent({ type: "turn-complete", skipped });
      if (this.wrapUp && !skipped) this._finishWrapUp();
    }
    if (message.goAway && !this.wrapUp) {
      this.onEvent({ type: "status", status: "reconnecting" });
      if (this.resumeHandle) this._resume();
    }
  }

  _finishWrapUp() {
    if (!this.wrapUp) return;
    clearTimeout(this.wrapTimer);
    const fresh = snapshotLines(this.transcript).slice(this.wrapStartCount);
    const text = fresh
      .filter((line) => line.role === "model")
      .map((line) => line.text)
      .join(" ");
    const { resolve } = this.wrapUp;
    this.wrapUp = null;
    resolve(text);
  }

  _pushPreroll(int16) {
    this.preroll.push(int16);
    this.prerollSamples += int16.length;
    while (this.prerollSamples > MAX_PREROLL && this.preroll.length > 1) {
      this.prerollSamples -= this.preroll.shift().length;
    }
  }

  _sendAudio(int16) {
    this._send(buildAudioMessage(pcm16ToBase64(int16)));
  }

  _send(message) {
    if (this.ws?.readyState !== 1) return;
    this.ws.send(JSON.stringify(message));
  }
}
