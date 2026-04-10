import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import astroRelatedContent from "../../../index.ts";
import { createFixtureEmbeddingProvider } from "../../../testing.ts";

export default defineConfig({
  integrations: [
    mdx(),
    astroRelatedContent({
      collections: [{ collection: "articles" }],
      embeddings: {
        provider: createFixtureEmbeddingProvider(),
      },
    }),
  ],
});
