import { mkdir, readFile } from "node:fs/promises";

import { GENERATOR_VERSION } from "./constants.ts";
import { readContentSources } from "./content.ts";
import { buildRuntimeDataModule, buildRuntimeModule } from "./runtime-module.ts";
import { stableSortObject, stableStringify, writeFileAtomic } from "./serialize.ts";
import type {
  ContentItem,
  EmbeddingProvider,
  EmbeddingProviderContext,
  GenerateRelatedContentResult,
  RelatedContentData,
  RelatedContentMatch,
  ResolvedIntegrationOptions,
  VectorCacheEntry,
  VectorCacheFile,
} from "./types.ts";

type GenerationLogger = (message: string) => void;

type GenerateRelatedContentHooks = {
  logger?: GenerationLogger;
};

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0),
  );

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Embedding providers must not return zero-length vectors.");
  }

  return vector.map((value) => value / magnitude);
}

function dotProduct(left: number[], right: number[]): number {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function isErrorWithCode(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

async function readVectorCache(filePath: string): Promise<VectorCacheFile | undefined> {
  try {
    const rawCache = await readFile(filePath, "utf8");
    return JSON.parse(rawCache) as VectorCacheFile;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function createCacheKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}

function assertConsistentVectors(vectors: number[][]): void {
  const [first] = vectors;
  if (!first) {
    return;
  }

  const expectedLength = first.length;

  for (const vector of vectors) {
    if (!Array.isArray(vector) || vector.length !== expectedLength) {
      throw new Error("Embedding providers must return vectors with a stable size.");
    }
  }
}

function buildProviderMetadata(
  provider: EmbeddingProvider<any, any>,
  providerOptions: unknown,
): Record<string, unknown> {
  return stableSortObject({
    generatorVersion: GENERATOR_VERSION,
    provider: provider.name,
    providerOptions: provider.getMetadata(providerOptions),
    providerVersion: provider.version,
  });
}

async function resolveProviderOptions(
  provider: EmbeddingProvider<any, any>,
  embeddings: ResolvedIntegrationOptions["embeddings"]["input"],
  context: EmbeddingProviderContext,
): Promise<unknown> {
  return provider.resolveOptions
    ? provider.resolveOptions(embeddings, context)
    : embeddings;
}

async function embedMissingItems(
  provider: EmbeddingProvider<any, any>,
  providerOptions: unknown,
  items: ContentItem[],
  batchSize: number,
  context: EmbeddingProviderContext,
  logger?: GenerationLogger,
): Promise<Map<string, number[]>> {
  const vectorsByKey = new Map<string, number[]>();
  const totalItems = items.length;

  if (totalItems > 0) {
    logger?.(
      `Embedding ${totalItems} content item${totalItems === 1 ? "" : "s"} with "${provider.name}".`,
    );
  }

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const start = index + 1;
    const end = index + batch.length;

    logger?.(
      `Embedding items ${start}-${end} of ${totalItems} (${batch
        .map((item) => `${item.collection}/${item.id}`)
        .join(", ")}).`,
    );
    const vectors = await provider.embed(
      batch.map((item) => item.semanticInput),
      providerOptions,
      context,
    );

    assertConsistentVectors(vectors);

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const item = batch[batchIndex];
      const vector = vectors[batchIndex];

      if (!item || !vector) {
        throw new Error("Embedding provider returned an incomplete batch result.");
      }

      vectorsByKey.set(createCacheKey(item.collection, item.id), normalizeVector(vector));
    }
  }

  return vectorsByKey;
}

function rankRelatedContent(
  items: ContentItem[],
  vectorsByKey: Map<string, number[]>,
  limit: number,
): RelatedContentData {
  const output: RelatedContentData = {};
  const itemsByCollection = new Map<string, ContentItem[]>();

  for (const item of items) {
    const collectionItems = itemsByCollection.get(item.collection) ?? [];
    collectionItems.push(item);
    itemsByCollection.set(item.collection, collectionItems);
  }

  for (const [collectionName, collectionItems] of itemsByCollection) {
    output[collectionName] = {};

    for (const item of collectionItems) {
      const itemKey = createCacheKey(item.collection, item.id);
      const itemVector = vectorsByKey.get(itemKey);

      if (!itemVector) {
        throw new Error(
          `Missing embedding for content item "${item.collection}/${item.id}".`,
        );
      }

      const rankedMatches: RelatedContentMatch[] = collectionItems
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => {
          const candidateVector = vectorsByKey.get(
            createCacheKey(candidate.collection, candidate.id),
          );

          if (!candidateVector) {
            throw new Error(
              `Missing embedding for content item "${candidate.collection}/${candidate.id}".`,
            );
          }

          return {
            id: candidate.id,
            score: dotProduct(itemVector, candidateVector),
          };
        })
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return left.id.localeCompare(right.id);
        })
        .slice(0, limit);

      output[collectionName][item.id] = rankedMatches;
    }
  }

  return stableSortObject(output);
}

export async function generateRelatedContent(
  options: ResolvedIntegrationOptions,
  hooks: GenerateRelatedContentHooks = {},
): Promise<GenerateRelatedContentResult> {
  await mkdir(options.codegenDir, { recursive: true });
  await mkdir(options.generation.cacheDir, { recursive: true });

  const provider = options.embeddings.provider;
  const providerContext: EmbeddingProviderContext = {
    codegenDir: options.codegenDir,
    collections: options.collections,
    rootDir: options.rootDir,
  };
  const providerOptions = await resolveProviderOptions(
    provider,
    options.embeddings.input,
    providerContext,
  );
  const providerMetadata = buildProviderMetadata(provider, providerOptions);
  const currentItems = await readContentSources(options.collections);
  const existingCache = await readVectorCache(options.vectorCachePath);
  const canReuseCache =
    stableStringify(existingCache?.metadata ?? {}) === stableStringify(providerMetadata);
  const cacheEntries = canReuseCache ? existingCache?.entries ?? {} : {};
  const reusedVectors = new Map<string, number[]>();
  const missingItems: ContentItem[] = [];

  for (const item of currentItems) {
    const cacheKey = createCacheKey(item.collection, item.id);
    const cachedEntry = cacheEntries[cacheKey];

    if (
      cachedEntry &&
      cachedEntry.hash === item.hash &&
      Array.isArray(cachedEntry.vector)
    ) {
      reusedVectors.set(cacheKey, cachedEntry.vector);
      continue;
    }

    missingItems.push(item);
  }

  const embeddedVectors = await embedMissingItems(
    provider,
    providerOptions,
    missingItems,
    options.embeddings.batchSize,
    providerContext,
    hooks.logger,
  );
  const allVectors = new Map<string, number[]>([...reusedVectors, ...embeddedVectors]);
  const vectorCacheEntries: Record<string, VectorCacheEntry> = {};

  for (const item of currentItems) {
    const cacheKey = createCacheKey(item.collection, item.id);
    const vector = allVectors.get(cacheKey);

    if (!vector) {
      throw new Error(
        `Missing embedding for content item "${item.collection}/${item.id}".`,
      );
    }

    vectorCacheEntries[cacheKey] = {
      collection: item.collection,
      hash: item.hash,
      id: item.id,
      vector,
    };
  }

  const relatedContentData = rankRelatedContent(
    currentItems,
    allVectors,
    options.generation.limit,
  );

  await writeFileAtomic(options.dataModulePath, buildRuntimeDataModule(relatedContentData));
  await writeFileAtomic(options.runtimeModulePath, buildRuntimeModule());
  await writeFileAtomic(
    options.vectorCachePath,
    `${stableStringify({
      entries: vectorCacheEntries,
      metadata: providerMetadata,
    })}\n`,
  );

  const result = {
    cacheInvalidated: !canReuseCache && Boolean(existingCache),
    embeddedCount: missingItems.length,
    reusedCount: reusedVectors.size,
    totalCount: currentItems.length,
  };

  hooks.logger?.(
    `Generated related content for ${result.totalCount} item${result.totalCount === 1 ? "" : "s"}: embedded ${result.embeddedCount}, reused ${result.reusedCount}${result.cacheInvalidated ? ", invalidated vector cache" : ""}.`,
  );

  return result;
}
