import type { AstroIntegration } from "astro";
import type { CollectionEntry, CollectionKey } from "astro:content";

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

declare module "virtual:astro-related-content" {
  export type RelatedContentMatch =
    import("@philnash/astro-related-content").RelatedContentMatch;
  export type RelatedContentResult<C extends CollectionKey> = {
    entry: CollectionEntry<C>;
    score: number;
  };
  export function getRelatedContent<C extends CollectionKey>(
    collection: C,
    id: string,
  ): Promise<RelatedContentResult<C>[]>;
  export function getRelatedContentIds(collection: string, id: string): string[];
  export function getRelatedContentMatches(
    collection: string,
    id: string,
  ): RelatedContentMatch[];
}
