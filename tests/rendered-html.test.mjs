import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("deployment source is internally consistent", async () => {
  const [packageText, lockText, page, layout] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("package-lock.json", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  const packageJson = JSON.parse(packageText);
  const lock = JSON.parse(lockText);

  assert.equal(packageJson.engines.node, ">=22.13.0");
  assert.equal(lock.packages[""].engines.node, packageJson.engines.node);
  assert.equal(packageJson.scripts.build, "next build");
  assert.match(packageJson.scripts.start, /^next start /);
  assert.match(page, /export default function Home/);
  assert.match(layout, /서무랜드/);
  assert.doesNotMatch(page + layout, /\uFFFD/);
});
