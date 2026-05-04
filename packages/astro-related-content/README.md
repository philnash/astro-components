# Astro Related Content

An Astro integration that generates related-content data for Astro content collections using embeddings.

## Installation

```sh
npm install @philnash/astro-related-content
```

## Usage

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articles = defineCollection({
  loader: glob({ base: "./src/content/articles", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = {
  articles,
};
```

Configure the integration in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      artifactDir: ".astro-related-content",
      collections: [{ collection: "articles" }],
    }),
  ],
});
```

Then import the virtual module in Astro code:

```astro
---
import { getRelatedContent } from "virtual:astro-related-content";

const relatedContent = await getRelatedContent("articles", "my-post");
---
```

`getRelatedContent("articles", ...)` resolves real entries from `astro:content`, so each result is typed as `CollectionEntry<"articles">`.

## Generated Artifacts

By default, the integration writes durable artifacts to `.astro-related-content/` in your project root:

- `data.json`: the ranked related-content data used by the runtime virtual module.
- `vectors.json`: the embedding cache used to avoid regenerating unchanged content vectors.

Commit this directory if you want deploy builds to reuse locally generated embeddings. The deploy will still run the integration during `astro build`, but unchanged content can reuse `vectors.json` instead of downloading models and embedding every item again.

You can choose a different project-relative directory with `artifactDir`:

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      artifactDir: "src/generated/related-content",
      collections: [{ collection: "articles" }],
    }),
  ],
});
```

The virtual module remains the public API. Application code should import from `virtual:astro-related-content`, not from the generated JSON files directly.

## Transformers.js Embeddings

The default embeddings provider uses [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers) through its `feature-extraction` pipeline. If you do not configure `embeddings.provider`, the integration uses `transformers.js` automatically.

Basic configuration:

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
    }),
  ],
});
```

This is equivalent to the default configuration:

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        model: "Xenova/all-MiniLM-L6-v2",
        device: "cpu",
        dtype: "fp32",
        pooling: "mean",
        batchSize: 1,
      },
    }),
  ],
});
```

Custom model configuration:

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        model: "Xenova/all-MiniLM-L6-v2",
        device: "cpu",
        dtype: "fp32",
        pooling: "mean",
        batchSize: 1,
        modelCacheDir: "./.astro/astro-related-content/models",
      },
    }),
  ],
});
```

Supported `transformers.js` options:

- `model`: Hugging Face model id. Default: `Xenova/all-MiniLM-L6-v2`
- `device`: inference device passed to the pipeline. Default: `cpu`
- `dtype`: model precision. Default: `fp32`
- `pooling`: pooling strategy for `feature-extraction`. Default: `mean`
- `batchSize`: number of items embedded per batch. Default: `1`
- `modelCacheDir`: where downloaded model files are cached. Default: `<project>/.astro/astro-related-content/models`

Notes:

- The model is downloaded on first use and then reused from `modelCacheDir`.
- `batchSize`, `model`, `device`, `dtype`, and `pooling` are part of the provider metadata, so changing them invalidates the stored vector cache and regenerates embeddings.
- CPU inference is the default and the safest option for local development and CI.
- `Xenova/all-MiniLM-L6-v2` is a compact default for short English text. The underlying Sentence Transformers model is intended for sentences and short paragraphs, and input longer than 256 word pieces is truncated by default. This integration currently embeds each content item as one string, so very long articles may be ranked mostly by their title and opening section.

The following examples show how to configure a few other embedding models that can run through the built-in Transformers.js provider. Treat them as starting points: model size, context length, pooling strategy, and local runtime support vary between model families.

### Qwen3 Embedding 0.6B

For longer multilingual content, Qwen3 Embedding 0.6B is available through an ONNX model prepared for Transformers.js. It supports a much longer context window than MiniLM, but it is also substantially larger and slower to run locally.

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        model: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
        dtype: "q8",
        pooling: "last_token",
        batchSize: 1,
      },
    }),
  ],
});
```

The original model is `Qwen/Qwen3-Embedding-0.6B`; the `onnx-community/Qwen3-Embedding-0.6B-ONNX` repository provides ONNX weights for Transformers.js.

### Granite Embedding R2

IBM's Granite Embedding R2 collection includes English and multilingual embedding models trained for retrieval. For an English content collection, the small English R2 model is available through a Transformers.js-compatible ONNX model.

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        model: "onnx-community/granite-embedding-small-english-r2-ONNX",
        dtype: "q8",
        pooling: "cls",
        batchSize: 1,
      },
    }),
  ],
});
```

The `onnx-community/granite-embedding-small-english-r2-ONNX` model is based on `ibm-granite/granite-embedding-small-english-r2`. Use `onnx-community/granite-embedding-english-r2-ONNX` for the larger English R2 model, or the `ibm-granite/granite-embedding-97m-multilingual-r2` and `ibm-granite/granite-embedding-311m-multilingual-r2` models if you need multilingual retrieval and can support their larger local runtime requirements.

### EmbeddingGemma

EmbeddingGemma is a compact multilingual embedding model from Google with a 2048-token context window. The Transformers.js-compatible ONNX model is `onnx-community/embeddinggemma-300m-ONNX`.

```js
import { defineConfig } from "astro/config";
import astroRelatedContent from "@philnash/astro-related-content";

export default defineConfig({
  integrations: [
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        model: "onnx-community/embeddinggemma-300m-ONNX",
        dtype: "q8",
        pooling: "mean",
        batchSize: 1,
      },
    }),
  ],
});
```

EmbeddingGemma is prompt-sensitive. For retrieval documents, Google recommends prefixing document text with `title: {title | "none"} | text: `. The built-in provider currently embeds the plugin's standard semantic input (`title` plus body text), so use a custom embedding provider if you need exact EmbeddingGemma prompt formatting before embeddings are generated.

## Testing Provider

The package also ships a deterministic fixture provider for tests and demos:

```js
import { createFixtureEmbeddingProvider } from "@philnash/astro-related-content/testing";
```
