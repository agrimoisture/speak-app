/**
 * Gemini Live WebSocket messages.
 * Checked against official docs on 2026-10-11:
 * - https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live
 * - https://ai.google.dev/gemini-api/docs/pricing
 * - https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
 * - https://ai.google.dev/api/live
 *
 * gemini-3.8-live is audio-only as a response modality. Do not send
 * thinkingLevel, and do not set proactiveAudio to false.
 */

export const LIVE_MODEL = "gemini-3.8-live";
export const FEEDBACK_MODEL = "gemini-3.8-flash";
export const LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const DIFFICULTY_GUIDE = {
  beginner: `Difficulty: beginner (about CEFR A2).
Use very common words. Keep most sentences under 12 words. Speak clearly and a little slowly. Ask only one question at a time. If the learner struggles, offer a short model sentence and invite them to repeat it, then continue the scene.`,
  intermediate: `Difficulty: intermediate (about CEFR B1).
Use natural everyday English at a moderate pace. Ask a follow-up question after you respond. You may use a common idiom if you immediately say it again in simpler English.`,
  advanced: `Difficulty: advanced (about CEFR B2 to C1).
Speak at a natural professional pace with richer vocabulary. Ask precise follow-up questions. Correct only mistakes that affect clarity or professionalism.`,
};

export function buildWsUrl(apiKey) {
  return `${LIVE_WS_URL}?key=${encodeURIComponent(apiKey)}`;
}

export function buildSystemInstruction({ topic, difficulty }) {
  const phrases = (topic.phrases || []).map((phrase) => `- ${phrase.en}`).join("\n");
  return `You are a warm English speaking tutor in a live voice conversation. The learner's first language is Traditional Chinese as used in Taiwan. Speak only English. Never switch the spoken conversation into Chinese.

Scenario: ${topic.scenarioEn}
Topic: ${topic.titleEn}
Phrases the learner might try. Do not read this list aloud. Use the situation naturally:
${phrases}

${DIFFICULTY_GUIDE[difficulty] || DIFFICULTY_GUIDE.beginner}

How to run the conversation:
- You speak first. Open in character with a short greeting and one question that brings the learner into the scenario.
- Keep the role-play going. After they answer, respond in character and ask a follow-up so the conversation continues.
- Briefly correct important grammar or word-choice mistakes in a friendly way, then continue. One short correction is enough. Do not lecture, and do not correct every small slip.
- You hear the learner's raw audio, not a separate transcript. If a word is hard to understand, gently model a clearer pronunciation inside the conversation, then move on.
- Stay inside this scenario until the learner ends the practice.`;
}

export function openingUserText() {
  return "Please start speaking now. Open the role-play in English with a short greeting and one question. Do not wait for me to speak first.";
}

export function wrapUpUserText() {
  return "The speaking practice is ending. In English, in under 20 seconds, mention only pronunciation issues you actually heard: say the word, then a clearer model. If you noticed none, say exactly: No pronunciation issues stood out. Do not give grammar corrections now. Do not ask a question.";
}

export function continuationText(lines) {
  const recent = (lines || [])
    .slice(-6)
    .map((line) => `${line.role === "user" ? "Learner" : "Tutor"}: ${line.text}`)
    .join("\n");
  return `We reconnected. Continue the same role-play in English. Do not start over and do not repeat the opening greeting. Recent lines:\n${recent || "(none yet)"}\nSay one short in-character line, then wait.`;
}

export function buildSetupMessage({ systemText, mode, resumeHandle = null, vocab = [] }) {
  const phrases = vocab.map((item) => String(item).slice(0, 80)).filter(Boolean).slice(0, 8);
  const inputAudioTranscription = { languageCodes: ["en"] };
  if (phrases.length) inputAudioTranscription.customVocabulary = phrases;
  const automaticActivityDetection =
    mode === "handsfree"
      ? { disabled: false, silenceDurationMs: 700, prefixPaddingMs: 200 }
      : { disabled: true };
  return {
    setup: {
      model: `models/${LIVE_MODEL}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
      systemInstruction: { parts: [{ text: systemText }] },
      inputAudioTranscription,
      outputAudioTranscription: { languageCodes: ["en"] },
      realtimeInputConfig: {
        automaticActivityDetection,
        activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      },
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      contextWindowCompression: { slidingWindow: {} },
    },
  };
}

export function buildClientText(text) {
  return {
    clientContent: {
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true,
    },
  };
}

export function buildAudioMessage(base64) {
  return {
    realtimeInput: {
      audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
    },
  };
}

export function buildActivityStart() {
  return { realtimeInput: { activityStart: {} } };
}

export function buildActivityEnd() {
  return { realtimeInput: { activityEnd: {} } };
}

export function buildAudioStreamEnd() {
  return { realtimeInput: { audioStreamEnd: true } };
}

export function extractAudioParts(message) {
  const parts = message?.serverContent?.modelTurn?.parts || [];
  const audio = [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;
    const mime = inline.mimeType || inline.mime_type || "";
    if (mime.startsWith("audio/") || mime.includes("pcm")) {
      audio.push({ data: inline.data, mime });
    }
  }
  return audio;
}

export function sampleRateFromMime(mime) {
  const match = /rate=(\d+)/.exec(mime || "");
  return match ? Number(match[1]) : 24000;
}
