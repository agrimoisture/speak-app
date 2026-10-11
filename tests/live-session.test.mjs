import assert from "node:assert/strict";
import test from "node:test";
import { LiveSession } from "../site/js/live-session.js";

class FakeWS {
  static all = [];

  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.sent = [];
    FakeWS.all.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }

  server(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 15));
}

function session(mode, events, player) {
  return new LiveSession({
    apiKey: "test-key-not-real",
    systemText: "Speak English.",
    mode,
    vocab: ["hello"],
    player,
    onEvent: (event) => events.push(event),
    WebSocketImpl: FakeWS,
  });
}

test("tap-to-talk waits for setup, then sends activity boundaries around audio", async () => {
  FakeWS.all = [];
  const events = [];
  const player = { enqueued: 0, stopped: 0, enqueue() { this.enqueued += 1; }, stop() { this.stopped += 1; } };
  const live = session("tap", events, player);
  live.start();
  live.pushPcm(new Int16Array([1, 2, 3]));
  await flush();
  const socket = FakeWS.all[0];
  assert.match(socket.url, /key=test-key-not-real/);
  assert.equal(JSON.stringify(socket.sent).includes("test-key-not-real"), false);
  assert.equal(socket.sent[0].setup.model, "models/gemini-3.8-live");
  assert.equal(socket.sent[0].setup.realtimeInputConfig.automaticActivityDetection.disabled, true);
  assert.equal(socket.sent.some((message) => message.realtimeInput?.audio), false);

  socket.server({ setupComplete: {} });
  const opening = socket.sent.at(-1);
  assert.match(opening.clientContent.turns[0].parts[0].text, /start speaking/i);
  live.pushPcm(new Int16Array([4, 5, 6]));
  assert.equal(socket.sent.some((message) => message.realtimeInput?.audio), false);
  assert.equal(live.beginUtterance(), true);
  assert.ok(socket.sent.some((message) => message.realtimeInput?.activityStart));
  assert.ok(socket.sent.some((message) => message.realtimeInput?.audio?.mimeType === "audio/pcm;rate=16000"));
  live.pushPcm(new Int16Array([7, 8]));
  live.endUtterance();
  assert.ok(socket.sent.some((message) => message.realtimeInput?.activityEnd));

  socket.server({
    serverContent: {
      outputTranscription: { text: "What would you like?" },
      modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAAA" } }] },
    },
  });
  assert.equal(player.enqueued, 1);
  const stoppedBefore = player.stopped;
  socket.server({
    serverContent: {
      interrupted: true,
      modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAAA" } }] },
    },
  });
  assert.equal(player.stopped, stoppedBefore + 1);
  assert.equal(player.enqueued, 1);
  assert.equal(events.some((event) => event.type === "transcript" && event.lines.some((line) => line.text.includes("What would you like?"))), true);
  live.stop();
});

test("hands-free streams audio without activity markers and can resume", async () => {
  FakeWS.all = [];
  const events = [];
  const live = session("handsfree", events, { enqueue() {}, stop() {} });
  live.start();
  await flush();
  const first = FakeWS.all[0];
  first.server({ setupComplete: {} });
  live.pushPcm(new Int16Array([1, 2, 3, 4]));
  assert.equal(first.sent.some((message) => message.realtimeInput?.activityStart), false);
  assert.equal(first.sent.some((message) => message.realtimeInput?.audio), true);
  live.pauseHandsfree();
  assert.ok(first.sent.some((message) => message.realtimeInput?.audioStreamEnd === true));

  first.server({ sessionResumptionUpdate: { newHandle: "resume-me", resumable: true } });
  first.server({ goAway: { timeLeft: "5s" } });
  await flush();
  assert.equal(FakeWS.all.length, 2);
  const second = FakeWS.all[1];
  assert.equal(second.sent[0].setup.sessionResumption.handle, "resume-me");
  second.server({ setupComplete: {} });
  assert.equal(second.sent.some((message) => /start speaking/i.test(JSON.stringify(message))), false);
  live.stop();
});

test("ending the session asks for pronunciation notes and ignores the interrupted turn", async () => {
  FakeWS.all = [];
  const live = session("tap", [], { enqueue() {}, stop() {} });
  live.start();
  await flush();
  const socket = FakeWS.all[0];
  socket.server({ setupComplete: {} });
  const pending = live.requestWrapUp();
  let settled = false;
  pending.then(() => {
    settled = true;
  });
  await flush();
  socket.server({ serverContent: { interrupted: true, turnComplete: true } });
  await flush();
  assert.equal(settled, false);
  socket.server({ serverContent: { outputTranscription: { text: "No pronunciation issues stood out." }, turnComplete: true } });
  assert.equal(await pending, "No pronunciation issues stood out.");
  live.stop();
});

test("switching mode reconnects with the new VAD setting", async () => {
  FakeWS.all = [];
  const live = session("tap", [], { enqueue() {}, stop() {} });
  live.start();
  await flush();
  FakeWS.all[0].server({ setupComplete: {} });
  live.changeMode("handsfree");
  await flush();
  const next = FakeWS.all.at(-1);
  assert.equal(next.sent[0].setup.realtimeInputConfig.automaticActivityDetection.disabled, false);
  next.server({ setupComplete: {} });
  assert.match(JSON.stringify(next.sent), /reconnected/i);
  live.stop();
});
