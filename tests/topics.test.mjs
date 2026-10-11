import assert from "node:assert/strict";
import test from "node:test";
import {
  TOPICS,
  customSelection,
  defaultSelection,
  indexForDate,
  loadSelection,
  rerollSelection,
  resolveTopic,
  saveSelection,
  selectionLabel,
  taipeiDateKey,
} from "../site/js/topics.js";

function memory() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("Taipei calendar date rolls over at UTC 16:00", () => {
  assert.equal(taipeiDateKey(new Date("2026-10-11T15:30:00Z")), "2026-10-11");
  assert.equal(taipeiDateKey(new Date("2026-10-11T16:30:00Z")), "2026-10-12");
});

test("the same date always picks the same topic", () => {
  const first = defaultSelection(new Date("2026-10-11T02:00:00Z"));
  const second = defaultSelection(new Date("2026-10-11T10:00:00Z"));
  assert.equal(first.dateKey, second.dateKey);
  assert.equal(first.index, second.index);
  assert.equal(indexForDate("2026-10-11", TOPICS.length), first.index);
});

test("built-in topics cover the requested scenarios", () => {
  const ids = TOPICS.map((topic) => topic.id);
  for (const id of [
    "restaurant",
    "farm-tour",
    "overseas-client",
    "microbial-fertilizer",
    "travel",
    "small-talk",
    "job-interview",
  ]) {
    assert.ok(ids.includes(id), id);
  }
  for (const topic of TOPICS) {
    assert.equal(topic.phrases.length, 3);
    assert.ok(topic.scenarioZh && topic.scenarioEn && topic.titleZh && topic.titleEn);
  }
});

test("reroll changes the topic and a new day restores the daily pick", () => {
  const storage = memory();
  const today = new Date("2026-10-11T02:00:00Z");
  const selection = defaultSelection(today);
  const rerolled = rerollSelection(selection, TOPICS, () => 0.99);
  assert.notEqual(rerolled.index, selection.index);
  assert.equal(rerolled.mode, "reroll");
  saveSelection(storage, rerolled);
  assert.equal(loadSelection(storage, today).index, rerolled.index);
  const tomorrow = loadSelection(storage, new Date("2026-10-12T02:00:00Z"));
  assert.equal(tomorrow.mode, "daily");
  assert.equal(tomorrow.dateKey, "2026-10-12");
});

test("custom topic replaces the daily card until it is cleared", () => {
  const selection = customSelection(defaultSelection(new Date("2026-10-11T02:00:00Z")), "  tea harvest  ");
  const topic = resolveTopic(selection);
  assert.equal(topic.custom, true);
  assert.equal(topic.titleZh, "tea harvest");
  assert.equal(selectionLabel(selection), "自訂主題");
  assert.equal(topic.phrases.length, 3);
});
