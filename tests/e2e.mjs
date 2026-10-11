import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/tmp/speak-e2e/package.json");
const puppeteer = require("puppeteer-core");

const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
const KEY = "test-key-not-real-123456";

const MOCK = `
window.__SPEAK_WS__ = [];
class MockWS {
  constructor(url) {
    this.url = String(url);
    this.readyState = 0;
    this.sent = [];
    window.__SPEAK_WS__.push(this);
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 20);
  }
  send(data) {
    const msg = JSON.parse(data);
    this.sent.push(msg);
    if (msg.setup) {
      setTimeout(() => {
        if (this.onmessage) this.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
      }, 30);
      setTimeout(() => {
        if (!this.onmessage) return;
        this.onmessage({
          data: JSON.stringify({
            serverContent: {
              outputTranscription: { text: "Hi, welcome. What would you like to order?" },
              modelTurn: {
                parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAAAAAAAAAA=" } }],
              },
            },
          }),
        });
        this.onmessage({ data: JSON.stringify({ serverContent: { turnComplete: true } }) });
      }, 60);
    }
    const text = msg.clientContent?.turns?.[0]?.parts?.[0]?.text || "";
    if (/pronunciation issues/i.test(text)) {
      setTimeout(() => {
        if (!this.onmessage) return;
        this.onmessage({
          data: JSON.stringify({
            serverContent: { outputTranscription: { text: "No pronunciation issues stood out." } },
          }),
        });
        this.onmessage({ data: JSON.stringify({ serverContent: { turnComplete: true } }) });
      }, 20);
    }
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code: 1000, reason: "" });
  }
}
function jsonResponse(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  };
}
window.__SPEAK_MOCKS__ = {
  WebSocket: MockWS,
  fetch: async (url) => {
    const href = String(url);
    if (href.includes(":generateContent")) {
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summaryZh: "你完成了一次點餐練習。",
                summaryEn: "You finished an ordering practice.",
                grammar: [{
                  original: "I want salad",
                  corrected: "I would like the salad",
                  noteZh: "點餐時 would like 比 want 客氣。",
                }],
                natural: [{
                  original: "give me water",
                  better: "Could I have some water?",
                  noteZh: "加 Could I 會比較自然。",
                }],
                pronunciation: [],
                reviewPhrases: [
                  { en: "Could I see the menu, please?", zh: "請給我看一下菜單好嗎？" },
                  { en: "What would you recommend?", zh: "你會推薦什麼？" },
                  { en: "I would like the salad", zh: "我想要沙拉。" },
                ],
              }),
            }],
          },
        }],
      });
    }
    return jsonResponse({ name: "models/gemini-3.8-live" });
  },
};
`;

function startServer() {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = join(siteRoot, pathname);
    const rootWithSep = siteRoot.endsWith(sep) ? siteRoot : siteRoot + sep;
    if (file !== siteRoot && !file.startsWith(rootWithSep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const server = await startServer();
const port = server.address().port;
const page = await browser.newPage();
const logs = [];
page.on("pageerror", (error) => logs.push(`pageerror: ${error}`));
page.on("console", (message) => {
  if (message.type() === "error") logs.push(`console: ${message.text()}`);
});
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(MOCK);

try {
  await page.goto(`http://127.0.0.1:${port}/?e2e=1`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#view-key")?.classList.contains("active"));
  const keyCopy = await page.$eval("#view-key", (node) => node.innerText);
  assert.match(keyCopy, /localStorage/);
  assert.match(keyCopy, /不會被放進網站檔案/);

  await page.type("#api-key", KEY);
  await page.click("#save-key");
  await page.waitForFunction(() => document.querySelector("#view-home")?.classList.contains("active"));
  await page.waitForFunction(() => (document.querySelector("#topic-title")?.textContent || "").length > 1);
  const phraseCount = await page.$$eval("#phrase-list li", (items) => items.length);
  assert.equal(phraseCount, 3);

  const before = await page.$eval("#topic-title", (node) => node.textContent);
  await page.click("#reroll-btn");
  await page.waitForFunction((previous) => document.querySelector("#topic-title")?.textContent !== previous, {}, before);

  await page.click("#custom-toggle");
  await page.type("#custom-input", "Talking about tea");
  await page.click("#custom-save");
  await page.waitForFunction(() => document.querySelector("#topic-title")?.textContent === "Talking about tea");
  await page.click('[data-difficulty="advanced"]');

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#view-home")?.classList.contains("active"));
  await page.waitForFunction(() => document.querySelector("#topic-title")?.textContent === "Talking about tea");
  await page.waitForFunction(
    () => document.querySelector('[data-difficulty="advanced"]')?.getAttribute("aria-pressed") === "true",
  );
  const stored = await page.evaluate(() => localStorage.getItem("speak-app.apiKey"));
  assert.equal(stored, KEY);
  const visible = await page.evaluate(() => document.body.innerText);
  assert.equal(visible.includes(KEY), false);

  await page.click("#start-btn");
  await page.waitForFunction(
    () => (document.querySelector("#transcript")?.textContent || "").includes("What would you like to order"),
    { timeout: 8000 },
  );
  await page.waitForFunction(() => document.querySelector("#talk-btn") && !document.querySelector("#talk-btn").disabled);
  await page.click("#talk-btn");
  await page.waitForFunction(() => document.querySelector("#view-session")?.dataset.recording === "on");
  await page.waitForFunction(() => (document.querySelector("#rec-timer")?.textContent || "").includes("正在傳送"));
  await page.click("#talk-btn");
  await page.waitForFunction(() => document.querySelector("#view-session")?.dataset.recording === "off");

  const sent = await page.evaluate(() => window.__SPEAK_WS__.flatMap((socket) => socket.sent));
  assert.ok(sent.some((message) => message.setup?.model === "models/gemini-3.8-live"));
  assert.equal(sent.some((message) => message.setup?.realtimeInputConfig?.automaticActivityDetection?.disabled === true), true);
  assert.ok(sent.some((message) => message.realtimeInput?.activityStart));
  assert.ok(sent.some((message) => message.realtimeInput?.activityEnd));
  assert.ok(sent.some((message) => /start speaking/i.test(message.clientContent?.turns?.[0]?.parts?.[0]?.text || "")));
  assert.equal(JSON.stringify(sent).includes(KEY), false);

  await page.click("#end-btn");
  await page.waitForFunction(() => document.body.innerText.includes("I would like the salad"), { timeout: 8000 });
  assert.match(await page.evaluate(() => document.body.innerText), /文法修正/);
  assert.match(await page.evaluate(() => document.body.innerText), /三句複習/);

  await page.click("#tab-history");
  await page.waitForFunction(() => document.body.innerText.includes("Talking about tea"));

  await page.click("#tab-settings");
  await page.click("#clear-key");
  await page.click("#clear-key");
  await page.waitForFunction(() => document.querySelector("#view-key")?.classList.contains("active"));
  assert.equal(await page.evaluate(() => localStorage.getItem("speak-app.apiKey")), null);

  if (logs.length) throw new Error(logs.join("\n"));
  console.log("e2e ok");
} catch (error) {
  const text = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  console.error(logs.join("\n"));
  console.error(text.slice(0, 2000));
  throw error;
} finally {
  await browser.close();
  server.close();
}
