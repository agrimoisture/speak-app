import assert from "node:assert/strict";
import test from "node:test";
import { createStore, keyLooksUsable, maskKey, normalizeApiKey } from "../site/js/storage.js";

function memory() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("api key stays in the provided storage and can be cleared", () => {
  const store = createStore(memory());
  assert.equal(store.getKey(), "");
  store.setKey("test-key-not-real-123456");
  assert.equal(store.getKey(), "test-key-not-real-123456");
  assert.equal(maskKey(store.getKey()), "test…3456");
  assert.equal(maskKey(store.getKey()).includes("not-real"), false);
  store.clearKey();
  assert.equal(store.getKey(), "");
});

test("normalizeApiKey accepts a raw key or a URL that contains one", () => {
  assert.equal(normalizeApiKey("  abcdefghij  "), "abcdefghij");
  assert.equal(normalizeApiKey("https://example.test/socket?key=abcdefghij"), "abcdefghij");
  assert.equal(keyLooksUsable("short"), false);
  assert.equal(keyLooksUsable("abcdefghij"), true);
  assert.equal(keyLooksUsable("abc defghij"), false);
});

test("history keeps the newest sessions and prefs ignore unknown values", () => {
  const store = createStore(memory());
  assert.deepEqual(store.getPrefs(), { difficulty: "beginner", mode: "tap" });
  store.setPrefs({ difficulty: "advanced", mode: "handsfree" });
  assert.deepEqual(store.getPrefs(), { difficulty: "advanced", mode: "handsfree" });
  store.setPrefs({ difficulty: "nope", mode: "nope" });
  assert.deepEqual(store.getPrefs(), { difficulty: "advanced", mode: "handsfree" });

  for (let i = 0; i < 35; i += 1) {
    store.addSession({
      id: `id-${i}`,
      createdAt: new Date(2026, 9, 11, 0, i).toISOString(),
      topic: { titleZh: `主題 ${i}` },
      difficulty: "beginner",
      transcript: [{ role: "user", text: "hello" }],
      feedback: null,
    });
  }
  const history = store.getHistory();
  assert.equal(history.length, 30);
  assert.equal(history[0].id, "id-34");
  store.updateSession("id-34", { feedbackError: "稍後再試" });
  assert.equal(store.getHistory()[0].feedbackError, "稍後再試");
  store.clearHistory();
  assert.deepEqual(store.getHistory(), []);
});
