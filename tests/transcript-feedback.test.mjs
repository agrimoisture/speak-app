import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, micErrorMessage, redactSecrets } from "../site/js/errors.js";
import {
  buildFeedbackPrompt,
  extractCandidateText,
  normalizeFeedback,
  parseFeedbackJson,
} from "../site/js/feedback.js";
import { createTranscriptState, mergeText, reduceTranscript } from "../site/js/transcript.js";

test("transcript accepts cumulative text and separate fragments", () => {
  let state = createTranscriptState();
  state = reduceTranscript(state, {
    serverContent: { interimInputTranscription: { text: "I want" } },
  });
  assert.equal(state.partialUser, "I want");
  state = reduceTranscript(state, {
    serverContent: { interimInputTranscription: { text: "I want salad" } },
  });
  state = reduceTranscript(state, {
    serverContent: { inputTranscription: { text: "I want salad" } },
  });
  state = reduceTranscript(state, {
    serverContent: { outputTranscription: { text: "Sure." }, turnComplete: true },
  });
  assert.equal(state.partialUser, "");
  assert.deepEqual(state.lines, [
    { role: "user", text: "I want salad" },
    { role: "model", text: "Sure." },
  ]);
  assert.equal(mergeText("Hello", "there"), "Hello there");
  assert.equal(mergeText("Hello", "Hello there"), "Hello there");
});

test("feedback prompt asks for Traditional Chinese and keeps pronunciation notes", () => {
  const prompt = buildFeedbackPrompt({
    topic: { titleEn: "Ordering", scenarioEn: "Order food." },
    difficulty: "beginner",
    lines: [{ role: "user", text: "I want salad" }],
    pronunciationHint: "No pronunciation issues stood out.",
  });
  assert.match(prompt, /Traditional Chinese/);
  assert.match(prompt, /I want salad/);
  assert.match(prompt, /No pronunciation issues stood out/);
  assert.match(prompt, /reviewPhrases/);
  const parsed = parseFeedbackJson(`\`\`\`json
  {"summaryZh":"做得好。","summaryEn":"Nice work.","grammar":[{"original":"I want salad","corrected":"I would like a salad.","noteZh":"點餐可以更客氣。"}],"natural":[],"pronunciation":[],"reviewPhrases":[{"en":"I would like a salad.","zh":"我想要一份沙拉。"},{"en":"","zh":"空的"},{"en":"What do you recommend?","zh":"你推薦什麼？"},{"en":"extra","zh":"多的"}]}
  `);
  assert.equal(parsed.grammar[0].corrected, "I would like a salad.");
  assert.equal(parsed.reviewPhrases.length, 3);
  assert.equal(parsed.reviewPhrases.some((item) => item.zh === "空的"), false);
  assert.equal(normalizeFeedback({}).grammar.length, 0);
  assert.equal(extractCandidateText({ candidates: [{ content: { parts: [{ thought: true, text: "hidden" }, { text: "shown" }] } }] }), "shown");
});

test("mic and api errors are explained in Traditional Chinese", () => {
  assert.match(micErrorMessage({ name: "NotAllowedError" }), /麥克風權限被拒絕/);
  assert.match(micErrorMessage({ name: "NotFoundError" }), /找不到可用的麥克風/);
  assert.match(micErrorMessage({ name: "NotReadableError" }), /其他 App/);
  assert.match(micErrorMessage({ name: "SecurityError" }), /HTTPS/);
  assert.match(apiErrorMessage(429, ""), /429/);
  assert.match(apiErrorMessage(403, JSON.stringify({ error: { message: "bad key=secret" } })), /沒有權限/);
  assert.equal(redactSecrets("wss://example/?key=abc", "abc").includes("abc"), false);
});
