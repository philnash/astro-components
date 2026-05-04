import assert from "node:assert/strict";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

import { generateRelatedContent } from "../src/generator.ts";
import { resolveIntegrationOptions } from "../src/options.ts";
import type { RelatedContentData, VectorCacheFile } from "../src/types.ts";
import { createFixtureEmbeddingProvider } from "../testing.ts";
import {
  createTempDirectory,
  removeDirectory,
  writeFiles,
} from "./helpers.ts";

async function createResolvedOptions(
  rootDir: string,
  provider: NonNullable<
    Parameters<typeof resolveIntegrationOptions>[0]["embeddings"]
  >["provider"],
) {
  return resolveIntegrationOptions(
    {
      collections: [{ collection: "articles" }],
      embeddings: { provider },
      generation: { limit: 2 },
    },
    {
      codegenDirUrl: pathToFileURL(join(rootDir, ".astro", "generated")),
      root: pathToFileURL(rootDir),
    },
  );
}

describe("generateRelatedContent", () => {
  it("generates runtime data and ranks related content deterministically", async () => {
    const rootDir = await createTempDirectory();
    try {
      await writeFiles(rootDir, {
        "src/content/articles/astro-components.md": `---
title: Astro Components
---
Astro components, reusable layouts, components, and site UI.`,
        "src/content/articles/semantic-search.mdx": `---
title: Semantic Search
---
Embeddings and semantic search help related content ranking in Astro.`,
        "src/content/articles/vector-ranking.md": `---
title: Vector Ranking
---
Vector search and embeddings improve related content ranking for Astro sites.`,
      });
      const options = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider(),
      );

      await generateRelatedContent(options);

      const relatedContentData = JSON.parse(
        await readFile(options.dataFilePath, "utf8"),
      ) as RelatedContentData;
      assert.deepEqual(
        relatedContentData.articles?.["vector-ranking"]?.map(
          (match) => match.id,
        ),
        ["semantic-search", "astro-components"],
      );
      assert.deepEqual(relatedContentData.missing, undefined);
      assert.deepEqual(relatedContentData.articles?.missing, undefined);
      assert.equal(
        options.dataFilePath,
        join(rootDir, ".astro-related-content", "data.json"),
      );
      assert.equal(
        options.vectorCachePath,
        join(rootDir, ".astro-related-content", "vectors.json"),
      );
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("reuses the vector cache when content is unchanged", async () => {
    const rootDir = await createTempDirectory();
    const embedCalls: string[][] = [];

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
title: Related Content A
---
Embeddings and Astro search.`,
        "src/content/articles/b.md": `---
title: Related Content B
---
Embeddings and related content in Astro.`,
      });
      const provider = createFixtureEmbeddingProvider({
        onEmbed(texts) {
          embedCalls.push(texts);
        },
      });
      const options = await createResolvedOptions(rootDir, provider);

      const firstRun = await generateRelatedContent(options);
      const secondRun = await generateRelatedContent(options);

      assert.equal(firstRun.embeddedCount, 2);
      assert.equal(secondRun.embeddedCount, 0);
      assert.equal(secondRun.reusedCount, 2);
      assert.equal(embedCalls.length, 2);
      assert.deepEqual(
        embedCalls.flat(),
        [
          "Related Content A\n\nEmbeddings and Astro search.",
          "Related Content B\n\nEmbeddings and related content in Astro.",
        ],
      );
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("invalidates cached vectors when provider metadata changes", async () => {
    const rootDir = await createTempDirectory();
    const embedCalls: string[] = [];

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
title: Metadata A
---
Embeddings and Astro search.`,
        "src/content/articles/b.md": `---
title: Metadata B
---
Embeddings and Astro ranking.`,
      });
      const options = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider({
          onEmbed() {
            embedCalls.push("v1");
          },
          version: "1",
        }),
      );

      await generateRelatedContent(options);

      const updatedOptions = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider({
          onEmbed() {
            embedCalls.push("v2");
          },
          version: "2",
        }),
      );
      const secondRun = await generateRelatedContent(updatedOptions);

      assert.equal(secondRun.cacheInvalidated, true);
      assert.deepEqual(embedCalls, ["v1", "v1", "v2", "v2"]);
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("removes deleted items from the cache", async () => {
    const rootDir = await createTempDirectory();

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
title: Cache A
---
Astro and embeddings.`,
        "src/content/articles/b.md": `---
title: Cache B
---
Astro and vectors.`,
      });
      const options = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider(),
      );

      await generateRelatedContent(options);
      await unlink(join(rootDir, "src/content/articles/b.md"));
      await generateRelatedContent(options);

      const cache = JSON.parse(
        await readFile(options.vectorCachePath, "utf8"),
      ) as VectorCacheFile;
      assert.deepEqual(Object.keys(cache.entries), ["articles:a"]);
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("fails clearly when a title is missing", async () => {
    const rootDir = await createTempDirectory();

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
---
This content is missing a title.`,
      });
      const options = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider(),
      );

      await assert.rejects(
        async () => generateRelatedContent(options),
        /missing a required frontmatter title/,
      );
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("falls back to tolerant plain-text extraction for invalid MDX syntax", async () => {
    const rootDir = await createTempDirectory();
    const embedCalls: string[][] = [];

    try {
      await writeFiles(rootDir, {
        "src/content/articles/invalid-syntax.mdx": `---
title: Invalid Syntax
---
<Callout appearance=accent>
Embeddings still need the content text.
</Callout>`,
        "src/content/articles/reference.md": `---
title: Reference
---
Embeddings still need the content text for related content.`,
      });
      const options = await createResolvedOptions(
        rootDir,
        createFixtureEmbeddingProvider({
          onEmbed(texts) {
            embedCalls.push(texts);
          },
        }),
      );

      await generateRelatedContent(options);

      assert.equal(embedCalls.length, 2);
      assert.match(embedCalls.flat().join("\n"), /Invalid Syntax/);
      assert.match(
        embedCalls.flat().join("\n"),
        /Embeddings still need the content text/,
      );
    } finally {
      await removeDirectory(rootDir);
    }
  });

  it("reports embedding progress through the generation logger", async () => {
    const rootDir = await createTempDirectory();
    const logs: string[] = [];

    try {
      await writeFiles(rootDir, {
        "src/content/articles/a.md": `---
title: Progress A
---
Astro embeddings alpha.`,
        "src/content/articles/b.md": `---
title: Progress B
---
Astro embeddings beta.`,
      });
      const options = resolveIntegrationOptions(
        {
          collections: [{ collection: "articles" }],
          embeddings: { batchSize: 1, provider: createFixtureEmbeddingProvider() },
          generation: { limit: 2 },
        },
        {
          codegenDirUrl: pathToFileURL(join(rootDir, ".astro", "generated")),
          root: pathToFileURL(rootDir),
        },
      );

      await generateRelatedContent(options, {
        logger(message) {
          logs.push(message);
        },
      });

      assert.equal(
        logs.some((message) => message.includes('Embedding 2 content items with "fixture".')),
        true,
      );
      assert.equal(
        logs.some((message) =>
          message.includes("Embedding items 1-1 of 2 (articles/a)."),
        ),
        true,
      );
      assert.equal(
        logs.some((message) =>
          message.includes("Embedding items 2-2 of 2 (articles/b)."),
        ),
        true,
      );
      assert.equal(
        logs.some((message) =>
          message.includes("Generated related content for 2 items: embedded 2, reused 0."),
        ),
        true,
      );
    } finally {
      await removeDirectory(rootDir);
    }
  });
});
