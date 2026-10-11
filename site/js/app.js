import { AudioEngine } from "./audio-engine.js";
import { requestFeedback, buildFeedbackPrompt, validateApiKey } from "./feedback.js";
import { insecureContextMessage, micErrorMessage } from "./errors.js";
import { LiveSession } from "./live-session.js";
import { LIVE_MODEL, buildSystemInstruction } from "./protocol.js";
import { createStore, formatTaipei, keyLooksUsable, maskKey, normalizeApiKey } from "./storage.js";
import {
  customSelection,
  defaultSelection,
  loadSelection,
  rerollSelection,
  resolveTopic,
  saveSelection,
  selectionLabel,
} from "./topics.js";

const DIFFICULTY_HELP = {
  beginner: "初級：短句、常用字，一次只問一個問題。",
  intermediate: "中級：日常英語，答完會再追問。",
  advanced: "進階：接近工作場合的速度與用字，只糾正會影響理解的錯誤。",
};

const MODE_HELP = {
  tap: "點一下開始把聲音傳出去，再點一下送出。麥克風會維持開啟，避免吃掉句子開頭；只有按鈕變成紅色時，聲音才會送給 AI。",
  handsfree: "免持會持續把聲音傳給 AI，對方自己判斷你說完了。你一開口就可以打斷對方。",
};

const store = createStore(localStorage);
const state = {
  view: "key",
  selection: loadSelection(sessionStorage),
  difficulty: "beginner",
  mode: "tap",
  engine: null,
  session: null,
  phase: "idle",
  ending: false,
  recording: false,
  muted: false,
  playing: false,
  lines: [],
  feedback: null,
  feedbackError: "",
  feedbackLoading: false,
  pending: null,
  savedId: "",
  activeTopic: null,
  historyOpenId: "",
  banner: "",
  keyError: "",
  settingsKeyError: "",
  keyBusy: false,
  confirmClearKey: false,
  confirmClearHistory: false,
  recordStarted: 0,
  sessionStarted: 0,
  timer: 0,
};

const $ = (id) => document.getElementById(id);
let paintQueued = false;

function boot() {
  const prefs = store.getPrefs();
  state.difficulty = prefs.difficulty;
  state.mode = prefs.mode;
  state.view = keyLooksUsable(store.getKey()) ? "home" : "key";
  $("model-name").textContent = LIVE_MODEL;
  bind();
  render();
  if ("serviceWorker" in navigator && !location.search.includes("e2e=1")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bind() {
  $("key-form").addEventListener("submit", onSaveKey);
  $("toggle-key-vis").addEventListener("click", () => toggleSecret($("api-key"), $("toggle-key-vis")));
  $("reroll-btn").addEventListener("click", () => {
    state.selection = rerollSelection(state.selection);
    saveSelection(sessionStorage, state.selection);
    state.banner = "";
    render();
  });
  $("custom-toggle").addEventListener("click", () => {
    $("custom-box").hidden = !$("custom-box").hidden;
  });
  $("custom-save").addEventListener("click", () => {
    const text = $("custom-input").value.trim();
    if (!text) {
      state.banner = "請先輸入主題。";
      render();
      return;
    }
    state.selection = customSelection(state.selection, text);
    saveSelection(sessionStorage, state.selection);
    state.banner = "";
    render();
  });
  $("custom-clear").addEventListener("click", () => {
    state.selection = defaultSelection();
    saveSelection(sessionStorage, state.selection);
    $("custom-input").value = "";
    render();
  });
  for (const button of document.querySelectorAll("[data-difficulty]")) {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      store.setPrefs({ difficulty: state.difficulty });
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      store.setPrefs({ mode: state.mode });
      render();
    });
  }
  $("start-btn").addEventListener("click", () => {
    startPractice();
  });
  $("talk-btn").addEventListener("click", onTalk);
  $("session-mode-btn").addEventListener("click", () => {
    if (!state.session || state.phase === "wrapping") return;
    state.mode = state.mode === "tap" ? "handsfree" : "tap";
    state.recording = false;
    state.muted = false;
    store.setPrefs({ mode: state.mode });
    state.session.changeMode(state.mode);
    render();
  });
  $("end-btn").addEventListener("click", () => {
    endSession();
  });
  $("retry-feedback").addEventListener("click", () => {
    if (state.pending) produceFeedback();
  });
  $("practice-again").addEventListener("click", () => {
    state.banner = "";
    show("home");
  });
  $("tab-home").addEventListener("click", () => show("home"));
  $("tab-history").addEventListener("click", () => show("history"));
  $("tab-settings").addEventListener("click", () => show("settings"));
  $("settings-save-key").addEventListener("click", onReplaceKey);
  $("clear-key").addEventListener("click", () => {
    if (!state.confirmClearKey) {
      state.confirmClearKey = true;
      render();
      setTimeout(() => {
        state.confirmClearKey = false;
        render();
      }, 4000);
      return;
    }
    store.clearKey();
    state.confirmClearKey = false;
    show("key");
  });
  $("clear-history").addEventListener("click", () => {
    if (!state.confirmClearHistory) {
      state.confirmClearHistory = true;
      render();
      setTimeout(() => {
        state.confirmClearHistory = false;
        render();
      }, 4000);
      return;
    }
    store.clearHistory();
    state.confirmClearHistory = false;
    state.historyOpenId = "";
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") state.engine?.unlock()?.catch(() => {});
  });
}

function show(view) {
  state.view = view;
  render();
}

function render() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    paint();
  });
}

function paint() {
  const titles = {
    key: "輸入金鑰",
    home: "今日練習",
    session: "對話中",
    feedback: "練習回饋",
    history: "練習紀錄",
    settings: "設定",
  };
  $("page-title").textContent = titles[state.view] || "英語口說";
  document.body.classList.toggle("no-tabs", state.view === "key" || state.view === "session");
  for (const view of document.querySelectorAll(".view")) {
    view.classList.toggle("active", view.id === `view-${state.view}`);
  }
  for (const tab of document.querySelectorAll("[data-nav]")) {
    tab.setAttribute("aria-current", tab.dataset.nav === state.view ? "page" : "false");
  }
  $("banner").hidden = !state.banner;
  $("banner").textContent = state.banner || "";
  paintKey();
  if (state.view === "home") paintHome();
  if (state.view === "session") paintSession();
  if (state.view === "feedback") paintFeedback();
  if (state.view === "history") paintHistory();
  if (state.view === "settings") paintSettings();
}

function paintKey() {
  $("key-error").textContent = state.keyError || "";
  $("save-key").disabled = state.keyBusy;
  $("save-key").textContent = state.keyBusy ? "驗證中…" : "儲存並開始";
}

function paintHome() {
  const topic = resolveTopic(state.selection);
  $("topic-kicker").textContent = selectionLabel(state.selection);
  $("topic-title").textContent = topic.titleZh;
  $("topic-title-en").textContent = topic.custom ? "自訂內容" : topic.titleEn;
  $("topic-scenario").textContent = topic.scenarioZh;
  fillPhrases($("phrase-list"), topic.phrases);
  if (document.activeElement !== $("custom-input") && state.selection.mode === "custom") {
    $("custom-input").value = state.selection.customText;
  }
  for (const button of document.querySelectorAll("[data-difficulty]")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  }
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  $("difficulty-help").textContent = DIFFICULTY_HELP[state.difficulty];
  $("mode-help").textContent = MODE_HELP[state.mode];
  $("start-btn").disabled = !keyLooksUsable(store.getKey()) || Boolean(state.session);
}

function paintSession() {
  const topic = state.activeTopic;
  $("session-kicker").textContent = topic ? selectionLabel(state.selection) : "";
  $("session-topic").textContent = topic ? topic.titleZh : "";
  const recordingOn =
    state.recording || (state.mode === "handsfree" && !state.muted && state.session?.isReady());
  const status = sessionStatus();
  $("view-session").dataset.status = status;
  $("view-session").dataset.recording = recordingOn ? "on" : "off";
  $("session-status").textContent = statusLabel(status);
  const talk = $("talk-btn");
  const ready = Boolean(state.session?.isReady()) && state.phase !== "wrapping";
  talk.disabled = !ready;
  talk.classList.toggle("is-recording", state.recording);
  talk.classList.toggle("is-live", state.mode === "handsfree" && !state.muted && ready);
  talk.setAttribute("aria-pressed", String(state.recording || (state.mode === "handsfree" && !state.muted && ready)));
  $("talk-label").textContent = talkLabel(ready);
  $("talk-hint").textContent = state.mode === "tap" ? MODE_HELP.tap : MODE_HELP.handsfree;
  $("session-mode-btn").textContent = state.mode === "tap" ? "改成免持" : "改成點按說話";
  $("end-btn").textContent = state.session?.isReady() ? "結束" : "取消";
  if (!state.recording) $("rec-timer").textContent = "";
  paintTranscript();
  updateClock();
}

function sessionStatus() {
  if (state.phase === "wrapping") return "wrapping";
  if (state.recording) return "recording";
  if (state.mode === "handsfree" && state.muted && state.session?.isReady()) return "muted";
  if (state.playing || state.phase === "speaking") return "speaking";
  if (state.phase === "opening") return "opening";
  if (state.phase === "reconnecting") return "reconnecting";
  if (state.phase === "connecting" || !state.session?.isReady()) return "connecting";
  if (state.mode === "handsfree") return "handsfree";
  return "listening";
}

function statusLabel(status) {
  return {
    wrapping: "正在整理發音筆記…",
    recording: "錄音中，再點一下送出",
    muted: "麥克風已暫停",
    speaking: "對方說話中",
    opening: "對方準備先開口…",
    reconnecting: "連線更新中，對話會接下去…",
    connecting: "正在連線…",
    handsfree: "免持聆聽中",
    listening: "輪到你了",
  }[status] || "準備中";
}

function talkLabel(ready) {
  if (!ready) return state.phase === "wrapping" ? "請稍候" : "連線中";
  if (state.mode === "handsfree") return state.muted ? "繼續聽" : "暫停麥克風";
  return state.recording ? "送出" : "開始說";
}

function paintTranscript() {
  const root = $("transcript");
  root.replaceChildren();
  if (!state.lines.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "開始對話後，如果 API 有回傳逐字稿，會出現在這裡。";
    root.append(empty);
    return;
  }
  for (const line of state.lines) {
    const row = document.createElement("div");
    row.className = `line ${line.role === "model" ? "model" : "user"}`;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = line.role === "model" ? "對方" : "你";
    const bubble = document.createElement("p");
    bubble.className = "bubble";
    bubble.textContent = line.text;
    row.append(who, bubble);
    root.append(row);
  }
}

function paintFeedback() {
  $("feedback-status").textContent = state.feedbackLoading
    ? "正在根據逐字稿產生繁體中文回饋…"
    : state.feedbackError || "";
  $("retry-feedback").hidden = state.feedbackLoading || !state.feedbackError;
  const root = $("feedback-root");
  root.replaceChildren();
  if (state.feedback) fillFeedback(root, state.feedback);
}

function paintHistory() {
  const root = $("history-list");
  root.replaceChildren();
  const history = store.getHistory();
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "fine";
    empty.textContent = "還沒有練習紀錄。完成一次對話並按結束後，回饋會出現在這裡。";
    root.append(empty);
    return;
  }
  for (const item of history) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card history-item${item.id === state.historyOpenId ? " history-open" : ""}`;
    const title = document.createElement("strong");
    title.textContent = item.topic?.titleZh || "未命名主題";
    const meta = document.createElement("span");
    meta.className = "fine";
    const level = { beginner: "初級", intermediate: "中級", advanced: "進階" }[item.difficulty] || "";
    meta.textContent = `${formatTaipei(item.createdAt)} · ${level}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      state.historyOpenId = state.historyOpenId === item.id ? "" : item.id;
      render();
    });
    root.append(button);
    if (item.id === state.historyOpenId) {
      const detail = document.createElement("div");
      detail.className = "card stack";
      if (item.feedback) fillFeedback(detail, item.feedback);
      else {
        const note = document.createElement("p");
        note.textContent = item.feedbackError || "這次沒有留下回饋。";
        detail.append(note);
      }
      root.append(detail);
    }
  }
}

function paintSettings() {
  $("settings-key-mask").textContent = maskKey(store.getKey());
  $("settings-key-error").textContent = state.settingsKeyError || "";
  $("clear-key").textContent = state.confirmClearKey ? "再按一次確認清除" : "清除金鑰";
  $("clear-history").textContent = state.confirmClearHistory ? "再按一次確認清除" : "清除練習紀錄";
}

function fillPhrases(list, phrases) {
  list.replaceChildren();
  for (const phrase of phrases || []) {
    const item = document.createElement("li");
    const en = document.createElement("span");
    en.className = "phrase-en";
    en.textContent = phrase.en;
    const zh = document.createElement("span");
    zh.className = "phrase-zh";
    zh.textContent = phrase.zh;
    item.append(en, zh);
    list.append(item);
  }
}

function fillFeedback(root, feedback) {
  root.append(block("總結", (box) => {
    addPair(box, "中文", feedback.summaryZh || "沒有摘要。");
    addPair(box, "English", feedback.summaryEn || "");
  }));
  const grammar = feedback.grammar || [];
  const natural = feedback.natural || [];
  const pronunciation = feedback.pronunciation || [];
  const reviewPhrases = feedback.reviewPhrases || [];
  root.append(block("文法修正", (box) => {
    if (!grammar.length) addNote(box, "這次沒有抓到需要修正的文法。");
    for (const item of grammar) {
      addPair(box, "原句", item.original);
      addPair(box, "改正", item.corrected);
      if (item.noteZh) addNote(box, item.noteZh);
    }
  }));
  root.append(block("更自然的說法", (box) => {
    if (!natural.length) addNote(box, "這次沒有另外的改寫建議。");
    for (const item of natural) {
      addPair(box, "原本", item.original);
      addPair(box, "可以說", item.better);
      if (item.noteZh) addNote(box, item.noteZh);
    }
  }));
  root.append(block("發音", (box) => {
    if (!pronunciation.length) addNote(box, "這次沒有留下聽得出來的發音筆記。");
    for (const item of pronunciation) {
      addPair(box, item.word, item.noteZh);
    }
  }));
  root.append(block("三句複習", (box) => {
    if (!reviewPhrases.length) addNote(box, "沒有產生複習句。");
    reviewPhrases.forEach((phrase, index) => {
      addPair(box, String(index + 1), `${phrase.en}${phrase.zh ? `（${phrase.zh}）` : ""}`);
    });
  }));
}

function block(title, fill) {
  const section = document.createElement("section");
  section.className = "card fb-block";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  fill(section);
  return section;
}

function addPair(parent, tag, text) {
  if (!text) return;
  const wrap = document.createElement("div");
  wrap.className = "pair";
  const label = document.createElement("p");
  label.className = "tag";
  label.textContent = tag;
  const body = document.createElement("p");
  body.textContent = text;
  wrap.append(label, body);
  parent.append(wrap);
}

function addNote(parent, text) {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = text;
  parent.append(note);
}

async function onSaveKey(event) {
  event.preventDefault();
  await saveKey($("api-key").value, (message) => {
    state.keyError = message;
  });
}

async function onReplaceKey() {
  const ok = await saveKey($("settings-key-input").value, (message) => {
    state.settingsKeyError = message;
  }, { stay: true });
  if (ok) $("settings-key-input").value = "";
}

async function saveKey(raw, setError, options = {}) {
  const key = normalizeApiKey(raw);
  if (!keyLooksUsable(key)) {
    setError("請貼上完整的 API 金鑰，中間不要有空白。");
    render();
    return false;
  }
  state.keyBusy = true;
  setError("");
  render();
  const fetchImpl = globalThis.__SPEAK_MOCKS__?.fetch || fetch;
  const result = await validateApiKey(key, fetchImpl);
  state.keyBusy = false;
  if (!result.ok && !result.offline) {
    setError(result.message);
    render();
    return false;
  }
  store.setKey(key);
  state.banner = result.offline ? result.message : "";
  state.keyError = "";
  state.settingsKeyError = "";
  if (!options.stay) {
    $("api-key").value = "";
    show("home");
  } else render();
  return true;
}

function toggleSecret(input, button) {
  const showText = input.type === "password";
  input.type = showText ? "text" : "password";
  button.textContent = showText ? "隱藏" : "顯示";
}

function startPractice() {
  if (state.session) return;
  state.banner = "";
  const blocked = insecureContextMessage(window.isSecureContext);
  if (blocked) {
    state.banner = blocked;
    render();
    return;
  }
  const topic = resolveTopic(state.selection);
  state.activeTopic = topic;
  state.lines = [];
  state.feedback = null;
  state.feedbackError = "";
  state.pending = null;
  state.savedId = "";
  state.recording = false;
  state.muted = false;
  state.playing = false;
  state.phase = "connecting";
  state.sessionStarted = Date.now();
  show("session");

  const engine = new AudioEngine();
  state.engine = engine;
  let gesture;
  try {
    gesture = engine.beginGesture();
  } catch (error) {
    teardown().then(() => {
      state.banner = micErrorMessage(error);
      show("home");
    });
    return;
  }
  const { resumePromise, micPromise } = gesture;
  resumePromise
    .then(() => micPromise)
    .then(async (stream) => {
      const WebSocketImpl = globalThis.__SPEAK_MOCKS__?.WebSocket || WebSocket;
      const session = new LiveSession({
        apiKey: store.getKey(),
        systemText: buildSystemInstruction({ topic, difficulty: state.difficulty }),
        mode: state.mode,
        vocab: (topic.phrases || []).map((phrase) => phrase.en),
        player: {
          enqueue: (data, rate) => engine.enqueue(data, rate),
          stop: () => engine.stopPlayback(),
        },
        onEvent: handleSessionEvent,
        WebSocketImpl,
      });
      state.session = session;
      engine.onPlaybackIdle = () => {
        state.playing = false;
        if (state.phase === "speaking" && !state.recording) state.phase = "listening";
        render();
      };
      await engine.attachStream(stream, (pcm) => state.session?.pushPcm(pcm));
      session.start();
      state.timer = setInterval(updateClock, 500);
      render();
    })
    .catch(async (error) => {
      await teardown();
      state.banner = micErrorMessage(error);
      show("home");
    });
}

function handleSessionEvent(event) {
  if (!state.session) return;
  if (event.type === "status") {
    if (event.status === "connecting") state.phase = "connecting";
    if (event.status === "ready") state.phase = "ready";
    if (event.status === "opening") state.phase = "opening";
    if (event.status === "reconnecting") state.phase = "reconnecting";
  }
  if (event.type === "audio") {
    state.playing = true;
    if (state.phase !== "wrapping" && !state.recording) state.phase = "speaking";
  }
  if (event.type === "interrupted") {
    state.playing = false;
    if (!state.recording && state.phase !== "wrapping") state.phase = "listening";
  }
  if (event.type === "turn-complete" && !event.skipped) {
    if (!state.engine?.isPlaying() && !state.recording && state.phase !== "wrapping") {
      state.playing = false;
      state.phase = "listening";
    }
  }
  if (event.type === "transcript") state.lines = event.lines;
  if (event.type === "error") state.banner = event.message;
  if (event.type === "closed" && state.view === "session" && state.phase !== "wrapping") {
    state.banner = event.message;
  }
  render();
}

function onTalk() {
  if (!state.session?.isReady() || state.phase === "wrapping") return;
  state.engine?.unlock()?.catch(() => {});
  if (state.mode === "handsfree") {
    state.muted = !state.muted;
    if (state.muted) state.session.pauseHandsfree();
    else state.session.resumeHandsfree();
  } else if (!state.recording) {
    const started = state.session.beginUtterance();
    if (!started) return;
    state.recording = true;
    state.recordStarted = Date.now();
  } else {
    state.recording = false;
    state.session.endUtterance();
  }
  render();
}

async function endSession() {
  if (state.ending) return;
  state.ending = true;
  if (!state.session?.isReady()) {
    await teardown();
    state.ending = false;
    show("home");
    return;
  }
  state.phase = "wrapping";
  state.recording = false;
  render();
  const topic = state.activeTopic;
  const difficulty = state.difficulty;
  const mode = state.mode;
  let hint = "";
  try {
    hint = await state.session.requestWrapUp();
  } catch {
    hint = "";
  }
  const lines = state.session?.getLines() || state.lines;
  await teardown();
  state.pending = { topic, difficulty, mode, lines, pronunciationHint: hint };
  state.feedback = null;
  state.feedbackError = "";
  show("feedback");
  try {
    await produceFeedback();
  } finally {
    state.ending = false;
  }
}

async function produceFeedback() {
  if (!state.pending) return;
  state.feedbackLoading = true;
  state.feedbackError = "";
  render();
  try {
    const fetchImpl = globalThis.__SPEAK_MOCKS__?.fetch || fetch;
    const feedback = await requestFeedback({
      apiKey: store.getKey(),
      prompt: buildFeedbackPrompt(state.pending),
      fetchImpl,
    });
    state.feedback = feedback;
    state.feedbackLoading = false;
    rememberSession(feedback, "");
  } catch (error) {
    state.feedbackLoading = false;
    state.feedbackError = error?.message || "無法產生回饋。";
    rememberSession(state.feedback, state.feedbackError);
  }
  render();
}

function rememberSession(feedback, error) {
  const item = {
    id: state.savedId || uid(),
    createdAt: new Date().toISOString(),
    topic: {
      titleZh: state.pending.topic?.titleZh || "",
      titleEn: state.pending.topic?.titleEn || "",
      scenarioZh: state.pending.topic?.scenarioZh || "",
    },
    difficulty: state.pending.difficulty,
    mode: state.pending.mode,
    feedback: feedback || null,
    feedbackError: error || "",
    transcript: state.pending.lines || [],
  };
  if (state.savedId) store.updateSession(state.savedId, item);
  else {
    state.savedId = item.id;
    store.addSession(item);
  }
}

async function teardown() {
  clearInterval(state.timer);
  state.timer = 0;
  state.recording = false;
  state.playing = false;
  state.muted = false;
  state.phase = "idle";
  const session = state.session;
  state.session = null;
  try {
    session?.stop();
  } catch {
    /* ignore */
  }
  const engine = state.engine;
  state.engine = null;
  try {
    await engine?.close();
  } catch {
    /* ignore */
  }
}

function updateClock() {
  if (!state.sessionStarted || state.view !== "session") return;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.sessionStarted) / 1000));
  $("session-clock").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  if (state.recording) {
    const spoken = Math.max(0, Math.floor((Date.now() - state.recordStarted) / 1000));
    $("rec-timer").textContent = `正在傳送 ${spoken} 秒`;
  }
}

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

boot();
