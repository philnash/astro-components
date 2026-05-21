/// <reference path="./virtual-module.d.ts" />

import type { AstroIntegration } from "astro";

import { createIntegration } from "./src/integration.ts";
import { createEmbeddingProvider } from "./src/providers/provider.ts";
import type { AstroRelatedContentOptions } from "./src/types.ts";

export type {
  AstroRelatedContentOptions,
  CustomEmbeddingsOptions,
  EmbeddingProvider,
  EmbeddingProviderContext,
  EmbeddingsOptions,
  GenerationOptions,
  RelatedContentCollection,
  RelatedContentMatch,
  RelatedContentResult,
  TransformersEmbeddingsOptions,
} from "./src/types.ts";

export { createEmbeddingProvider };

export function astroRelatedContent(
  options: AstroRelatedContentOptions,
): AstroIntegration {
  return createIntegration(options);
}

export default astroRelatedContent;
