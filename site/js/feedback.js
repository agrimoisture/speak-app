import { FEEDBACK_MODEL, LIVE_MODEL } from "./protocol.js";
import { apiErrorMessage } from "./errors.js";

export function buildFeedbackPrompt({ topic, difficulty, lines, pronunciationHint }) {
  const conversation = (lines || [])
    .map((line) => `${line.role === "user" ? "Learner" : "Tutor"}: ${line.text}`)
    .join("\n");
  const difficultyLabel =
    difficulty === "advanced" ? "advanced" : difficulty === "intermediate" ? "intermediate" : "beginner";
  return `You write end-of-session feedback for an English speaking practice.
The learner reads Traditional Chinese as used in Taiwan. Notes in Chinese must use Traditional Chinese, not Simplified Chinese.
The spoken lesson was in English. Base grammar and phrasing comments on the transcript. Do not invent mistakes that are not supported by the transcript.
For pronunciation, use only the live tutor notes below. If those notes say nothing was noticed, or there are no notes, return an empty pronunciation array. Do not guess how the learner pronounced a word from text alone.

Return ONLY JSON with this shape:
{
  "summaryZh": "two or three sentences in Traditional Chinese",
  "summaryEn": "one or two sentences in English",
  "grammar": [{"original": "what the learner said", "corrected": "corrected English", "noteZh": "short Traditional Chinese note"}],
  "natural": [{"original": "learner's wording", "better": "more natural English", "noteZh": "short Traditional Chinese note"}],
  "pronunciation": [{"word": "English word", "noteZh": "Traditional Chinese note"}],
  "reviewPhrases": [{"en": "useful English phrase", "zh": "Traditional Chinese gloss"}, {"en": "", "zh": ""}, {"en": "", "zh": ""}]
}

Rules:
- grammar: at most 5 important mistakes. Use [] if the transcript shows none.
- natural: at most 4 more natural alternatives. Use [] if there is nothing to add.
- reviewPhrases: exactly 3 phrases that fit this topic and the ${difficultyLabel} level.
- If the transcript is almost empty, say that in summaryZh and still provide 3 review phrases for the topic.

Topic: ${topic?.titleEn || ""}
Scenario: ${topic?.scenarioEn || ""}
Difficulty: ${difficultyLabel}
Live tutor pronunciation notes:
${pronunciationHint?.trim() || "(none captured)"}

Transcript:
${conversation || "(empty)"}`;
}

export function parseFeedbackJson(text) {
  let raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) raw = fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  return normalizeFeedback(JSON.parse(raw));
}

export function normalizeFeedback(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    summaryZh: textField(source.summaryZh),
    summaryEn: textField(source.summaryEn),
    grammar: listOf(source.grammar, (item) => ({
      original: textField(item.original),
      corrected: textField(item.corrected),
      noteZh: textField(item.noteZh),
    })).slice(0, 5),
    natural: listOf(source.natural, (item) => ({
      original: textField(item.original),
      better: textField(item.better),
      noteZh: textField(item.noteZh),
    })).slice(0, 4),
    pronunciation: listOf(source.pronunciation, (item) => ({
      word: textField(item.word),
      noteZh: textField(item.noteZh),
    })).slice(0, 6),
    reviewPhrases: listOf(source.reviewPhrases, (item) => ({
      en: textField(item.en),
      zh: textField(item.zh),
    }))
      .filter((item) => item.en)
      .slice(0, 3),
  };
}

export function extractCandidateText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((part) => part && typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function validateApiKey(apiKey, fetchImpl = globalThis.fetch) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LIVE_MODEL}?key=${encodeURIComponent(apiKey)}`;
  let response;
  try {
    response = await fetchImpl(url);
  } catch {
    return {
      ok: false,
      offline: true,
      message: "現在連不到 Google。金鑰已先存在這台裝置，開始練習時會再連一次。",
    };
  }
  if (response.ok) return { ok: true, offline: false, message: "" };
  const body = await response.text();
  return { ok: false, offline: false, message: apiErrorMessage(response.status, body) };
}

export async function requestFeedback({ apiKey, prompt, fetchImpl = globalThis.fetch }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${FEEDBACK_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const base = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
  };
  let response = await postJson(fetchImpl, url, base);
  if (response.status === 400) {
    response = await postJson(fetchImpl, url, {
      contents: base.contents,
      generationConfig: { temperature: 0.4 },
    });
  }
  if (!response.ok) {
    throw new Error(apiErrorMessage(response.status, await response.text()));
  }
  const payload = await response.json();
  const text = extractCandidateText(payload);
  if (!text) throw new Error("回饋沒有內容。請再按一次重新產生。");
  try {
    return parseFeedbackJson(text);
  } catch {
    throw new Error("回饋格式無法讀取。請再按一次重新產生。");
  }
}

async function postJson(fetchImpl, url, body) {
  return fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function textField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function listOf(value, map) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map(map);
}
