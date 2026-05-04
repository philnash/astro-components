import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

import { build, sync } from "astro";

const fixtureAppPath = fileURLToPath(new URL("./fixtures/basic-app/", import.meta.url));
const fixtureArtifactPath = join(fixtureAppPath, ".astro-related-content");

describe("Astro integration", () => {
  beforeEach(async () => {
    await rm(fixtureArtifactPath, { force: true, recursive: true });
    await rm(join(fixtureAppPath, ".astro"), { force: true, recursive: true });
    await rm(join(fixtureAppPath, "dist"), { force: true, recursive: true });
  });

  it("supports astro sync and astro build with the virtual module", async () => {
    await sync({ root: fixtureAppPath });
    await access(join(fixtureAppPath, ".astro/types.d.ts"));
    await access(join(fixtureArtifactPath, "data.json"));
    await access(join(fixtureArtifactPath, "vectors.json"));

    await build({ root: fixtureAppPath });

    const html = await readFile(join(fixtureAppPath, "dist/index.html"), "utf8");
    assert.match(html, /Vector Ranking/);
    assert.match(html, /Astro Components/);
  });
});
