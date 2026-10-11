import assert from "node:assert/strict";
import test from "node:test";
import { base64ToPcm16, downsampleToPcm16, pcm16ToBase64 } from "../site/js/pcm.js";
import {
  LIVE_MODEL,
  buildActivityEnd,
  buildActivityStart,
  buildAudioMessage,
  buildSetupMessage,
  buildSystemInstruction,
  buildWsUrl,
  extractAudioParts,
  openingUserText,
} from "../site/js/protocol.js";
import { TOPICS } from "../site/js/topics.js";

const topic = TOPICS[0];

test("setup uses the free-tier live model and manual VAD for tap-to-talk", () => {
  const message = buildSetupMessage({
    systemText: "Be kind.",
    mode: "tap",
    vocab: ["Could I see the menu, please?"],
  });
  assert.equal(message.setup.model, `models/${LIVE_MODEL}`);
  assert.deepEqual(message.setup.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(message.setup.realtimeInputConfig.automaticActivityDetection.disabled, true);
  assert.equal(message.setup.inputAudioTranscription.customVocabulary[0].includes("menu"), true);
  assert.ok(message.setup.contextWindowCompression.slidingWindow);
  assert.deepEqual(message.setup.sessionResumption, {});
  const raw = JSON.stringify(message);
  assert.equal(raw.includes("thinkingLevel"), false);
  assert.equal(raw.includes("proactiveAudio"), false);
  assert.equal(raw.includes("test-key"), false);
});

test("hands-free keeps automatic VAD and can resume a handle", () => {
  const message = buildSetupMessage({
    systemText: "Be kind.",
    mode: "handsfree",
    resumeHandle: "handle-1",
  });
  assert.equal(message.setup.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.equal(message.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 700);
  assert.equal(message.setup.sessionResumption.handle, "handle-1");
});

test("system prompt keeps the conversation in English and matches difficulty", () => {
  const beginner = buildSystemInstruction({ topic, difficulty: "beginner" });
  const advanced = buildSystemInstruction({ topic, difficulty: "advanced" });
  assert.match(beginner, /Speak only English/);
  assert.match(beginner, /speak first/i);
  assert.match(beginner, new RegExp(topic.scenarioEn.slice(0, 24)));
  assert.match(beginner, /under 12 words/);
  assert.match(advanced, /professional pace/);
  assert.match(openingUserText(), /Do not wait/);
});

test("websocket url carries the key only as a query parameter", () => {
  const url = buildWsUrl("abc/def");
  assert.match(url, /^wss:\/\/generativelanguage\.googleapis\.com\/ws\//);
  assert.match(url, /key=abc%2Fdef/);
  const audio = buildAudioMessage("AAAA");
  assert.equal(audio.realtimeInput.audio.mimeType, "audio/pcm;rate=16000");
  assert.deepEqual(buildActivityStart(), { realtimeInput: { activityStart: {} } });
  assert.deepEqual(buildActivityEnd(), { realtimeInput: { activityEnd: {} } });
});

test("pcm16 base64 round-trips and audio parts are found on model turns", () => {
  const pcm = downsampleToPcm16(new Float32Array([0, 0.5, -0.5, 1, -1]), 16000, 16000);
  assert.equal(pcm.length, 5);
  assert.equal(pcm[0], 0);
  assert.ok(pcm[1] > 0);
  assert.ok(pcm[2] < 0);
  const restored = base64ToPcm16(pcm16ToBase64(pcm));
  assert.deepEqual(Array.from(restored), Array.from(pcm));
  const parts = extractAudioParts({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAAA" } }, { text: "hi" }] },
    },
  });
  assert.equal(parts.length, 1);
  assert.equal(parts[0].mime, "audio/pcm;rate=24000");
});
