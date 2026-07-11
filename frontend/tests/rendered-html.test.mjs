import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/simulation") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the immersive simulation shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Forearm Laceration/);
  assert.match(html, /Alex Morgan/);
  assert.match(html, /AI Coach/);
  assert.doesNotMatch(html, /No headset required|How it works|Launch Prototype/);
});

test("renders an honest launcher and an empty debrief before training", async () => {
  const launcher = await render("/scenarios");
  assert.equal(launcher.status, 200);
  const launcherHtml = await launcher.text();
  assert.match(launcherHtml, /Scenario library/);
  assert.match(launcherHtml, /Start simulation/);
  assert.match(launcherHtml, /Coming soon/);

  const results = await render("/results");
  assert.equal(results.status, 200);
  assert.match(await results.text(), /No completed simulation yet/);
});
