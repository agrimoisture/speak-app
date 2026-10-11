import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;

async function filesUnder(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(path)));
    else found.push(path);
  }
  return found;
}

test("the public site does not contain an API key", async () => {
  const paths = (await filesUnder(root)).filter((path) => !path.includes("/.git/") && !path.endsWith(".png"));
  const pattern = /AIza[0-9A-Za-z_-]{20,}/;
  for (const path of paths) {
    const text = await readFile(path, "utf8");
    assert.equal(pattern.test(text), false, path);
  }
});

test("pages workflow, manifest, and Traditional Chinese controls are present", async () => {
  const html = await readFile(join(root, "site/index.html"), "utf8");
  for (const text of ["初級", "中級", "進階", "點按說話", "免持", "換一個主題", "自訂主題", "結束", "localStorage"]) {
    assert.equal(html.includes(text), true, text);
  }
  const manifest = JSON.parse(await readFile(join(root, "site/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "英語口說練習");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  const workflow = await readFile(join(root, ".github/workflows/pages.yml"), "utf8");
  assert.match(workflow, /github-pages/);
  assert.match(workflow, /path:\s*site/);
  assert.match(workflow, /branches:\s*\[main\]/);
});
