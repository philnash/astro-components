import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readContentSources } from "../src/content.ts";
import {
  createTempDirectory,
  removeDirectory,
  writeFiles,
} from "./helpers.ts";

describe("readContentSources", () => {
  it("returns only the fields required by generation", async () => {
    const rootDir = await createTempDirectory();

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
title: Article A
---
Readable content for embeddings.`,
      });

      const [item] = await readContentSources([
        {
          collection: "articles",
          dir: join(rootDir, "src/content/articles"),
          include: [],
        },
      ]);

      assert.deepEqual(Object.keys(item ?? {}).sort(), [
        "collection",
        "hash",
        "id",
        "semanticInput",
      ]);
    } finally {
      await removeDirectory(rootDir);
    }
  });
});
