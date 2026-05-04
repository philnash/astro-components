import type { CollectionEntry, CollectionKey } from "astro:content";

export type RelatedContentMatch = {
  id: string;
  score: number;
};

export type RelatedContentResult<C extends CollectionKey> = {
  entry: CollectionEntry<C>;
  score: number;
};

export type RelatedContentData = Record<string, Record<string, RelatedContentMatch[]>>;

export type RelatedContentCollection = {
  collection: string;
  include?: string | string[];
};

export type ResolvedRelatedContentCollection = {
  collection: string;
  dir: string;
  include: string[];
};

export type GenerationOptions = {
  limit?: number;
  watch?: boolean;
};

export type ResolvedGenerationOptions = {
  limit: number;
  watch: boolean;
};

export type EmbeddingProviderContext = {
  codegenDir: string;
  collections: ResolvedRelatedContentCollection[];
  rootDir: string;
};

export type EmbeddingsInput = Record<string, unknown> & {
  batchSize?: number;
  provider?: string | EmbeddingProvider<any, any>;
};

export type EmbeddingProvider<
  TOptions = Record<string, unknown>,
  TInput extends EmbeddingsInput = EmbeddingsInput,
> = {
  embed: (
    texts: string[],
    options: TOptions,
    context: EmbeddingProviderContext,
  ) => Promise<number[][]> | number[][];
  getMetadata: (options: TOptions) => Record<string, unknown>;
  name: string;
  resolveOptions?: (
    embeddings: TInput,
    context: EmbeddingProviderContext,
  ) => Promise<TOptions> | TOptions;
  version: string;
};

export type TransformersEmbeddingsOptions = {
  batchSize?: number;
  device?: string;
  dtype?: string;
  model?: string;
  modelCacheDir?: string;
  pooling?: string;
  provider?: "transformers";
};

export type CustomEmbeddingsOptions = EmbeddingsInput & {
  provider: EmbeddingProvider<any, any>;
};

export type EmbeddingsOptions =
  | TransformersEmbeddingsOptions
  | CustomEmbeddingsOptions;

export type AstroRelatedContentOptions = {
  artifactDir?: string;
  codegenDir?: string;
  collections: RelatedContentCollection[];
  embeddings?: EmbeddingsOptions;
  generation?: GenerationOptions;
  rootDir?: string;
};

export type ResolvedEmbeddingsOptions = {
  batchSize: number;
  input: EmbeddingsInput;
  provider: EmbeddingProvider<any, any>;
};

export type ResolvedIntegrationOptions = {
  artifactDir: string;
  codegenDir: string;
  collections: ResolvedRelatedContentCollection[];
  dataFilePath: string;
  embeddings: ResolvedEmbeddingsOptions;
  generation: ResolvedGenerationOptions;
  rootDir: string;
  vectorCachePath: string;
};

export type ContentItem = {
  collection: string;
  hash: string;
  id: string;
  semanticInput: string;
};

export type VectorCacheEntry = {
  collection: string;
  hash: string;
  id: string;
  vector: number[];
};

export type VectorCacheFile = {
  entries: Record<string, VectorCacheEntry>;
  metadata: Record<string, unknown>;
};

export type GenerateRelatedContentResult = {
  cacheInvalidated: boolean;
  embeddedCount: number;
  reusedCount: number;
  totalCount: number;
};

export type GenerationRequest = {
  isWatch: boolean;
};

export type GenerationScheduler = {
  runNow(context?: Partial<GenerationRequest>): Promise<void>;
  schedule(context?: Partial<GenerationRequest>): Promise<void>;
};
