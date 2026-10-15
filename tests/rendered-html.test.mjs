import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the 词穹 product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>词穹 · 雅思词汇记忆空间<\/title>/i);
  assert.match(html, /让每一个词/);
  assert.match(html, /今日计划/);
  assert.match(html, /今日复习/);
  assert.match(html, /64 LISTS/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the original vocabulary and independent V2 content files", async () => {
  const [vocab, themes, extensions] = await Promise.all([
    readFile(new URL("../public/vocab.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/data/list-themes.v1.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/data/vocab-expansions.demo.v1.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.equal(vocab.length, 64);
  assert.equal(themes.lists.length, 64);
  assert.equal(extensions.entries.length, 30);
  assert.equal(extensions.status, "draft-for-human-review");
});
