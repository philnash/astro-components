import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { before, describe, it } from "node:test";

const demoPagePath = fileURLToPath(
  new URL("../../../demo/dist/related-content/index.html", import.meta.url),
);
const demoSources = [
  fileURLToPath(new URL("../../../demo/astro.config.mjs", import.meta.url)),
  fileURLToPath(new URL("../../../demo/src/content.config.ts", import.meta.url)),
  fileURLToPath(new URL("../../../demo/src/pages/related-content.astro", import.meta.url)),
];

describe("demo related content page", () => {
  let html = "";
  const shouldSkip =
    !existsSync(demoPagePath) ||
    demoSources.some((sourcePath) => statSync(sourcePath).mtimeMs > statSync(demoPagePath).mtimeMs);

  before(async () => {
    if (shouldSkip) {
      return;
    }

    html = await readFile(demoPagePath, "utf8");
  });

  it(
    "renders related content from the generated virtual module",
    { skip: shouldSkip },
    () => {
      assert.match(html, /Semantic Search/);
      assert.match(html, /Astro Components/);
    },
  );
});
