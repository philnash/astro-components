import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { resolveIntegrationOptions } from "../src/options.ts";

describe("resolveIntegrationOptions", () => {
  it("applies defaults for generation and transformers embeddings", () => {
    const options = resolveIntegrationOptions(
      {
        collections: [{ collection: "posts" }],
      },
      {
        codegenDirUrl: pathToFileURL("/tmp/astro-related-content/codegen"),
        root: pathToFileURL("/tmp/astro-related-content/project"),
      },
    );

    assert.equal(options.generation.limit, 5);
    assert.equal(options.generation.watch, true);
    assert.equal(options.embeddings.batchSize, 1);
    assert.equal(options.embeddings.provider.name, "transformers");
    assert.equal(
      options.collections[0]?.dir,
      "/tmp/astro-related-content/project/src/content/posts",
    );
  });

  it("rejects empty collections", () => {
    assert.throws(
      () =>
        resolveIntegrationOptions(
          { collections: [] },
          {
            codegenDirUrl: pathToFileURL("/tmp/astro-related-content/codegen"),
            root: pathToFileURL("/tmp/astro-related-content/project"),
          },
        ),
      /at least one configured collection/,
    );
  });

  it("rejects duplicate collection names", () => {
    assert.throws(
      () =>
        resolveIntegrationOptions(
          {
            collections: [
              { collection: "posts" },
              { collection: "posts" },
            ],
          },
          {
            codegenDirUrl: pathToFileURL("/tmp/astro-related-content/codegen"),
            root: pathToFileURL("/tmp/astro-related-content/project"),
          },
        ),
      /Duplicate collection/,
    );
  });

  it("rejects invalid batch size", () => {
    assert.throws(
      () =>
        resolveIntegrationOptions(
          {
            collections: [{ collection: "posts" }],
            embeddings: { batchSize: 0 },
          },
          {
            codegenDirUrl: pathToFileURL("/tmp/astro-related-content/codegen"),
            root: pathToFileURL("/tmp/astro-related-content/project"),
          },
        ),
      /embeddings\.batchSize must be a positive integer/,
    );
  });
});
