import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createTransformersEmbeddingProvider } from "./providers/transformers.ts";
import type {
  AstroRelatedContentOptions,
  EmbeddingProvider,
  EmbeddingsInput,
  ResolvedIntegrationOptions,
  ResolvedRelatedContentCollection,
} from "./types.ts";

function resolvePath(rootDir: string, value?: string): string {
  if (!value) {
    return rootDir;
  }

  return isAbsolute(value) ? value : resolve(rootDir, value);
}

function normalizeInclude(include?: string | string[]): string[] {
  if (!include) {
    return [];
  }

  if (Array.isArray(include)) {
    return include;
  }

  return [include];
}

function requirePositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function resolveProvider(embeddings: EmbeddingsInput): EmbeddingProvider<any, any> {
  if (!embeddings.provider || embeddings.provider === "transformers") {
    return createTransformersEmbeddingProvider();
  }

  if (typeof embeddings.provider === "object") {
    return embeddings.provider;
  }

  throw new Error(
    `Unsupported embeddings.provider value "${String(embeddings.provider)}".`,
  );
}

function resolveCollections(
  rootDir: string,
  collections: AstroRelatedContentOptions["collections"],
): ResolvedRelatedContentCollection[] {
  const seenCollections = new Set<string>();

  return collections.map((collection) => {
    if (!collection || typeof collection !== "object") {
      throw new Error("Each collection must be a configuration object.");
    }

    if (
      typeof collection.collection !== "string" ||
      collection.collection.length === 0
    ) {
      throw new Error("Each collection must define a non-empty collection name.");
    }

    if (seenCollections.has(collection.collection)) {
      throw new Error(
        `Duplicate collection "${collection.collection}" is not allowed.`,
      );
    }

    seenCollections.add(collection.collection);

    return {
      collection: collection.collection,
      dir: resolvePath(rootDir, join("src", "content", collection.collection)),
      include: normalizeInclude(collection.include),
    };
  });
}

export function resolveIntegrationOptions(
  userOptions: AstroRelatedContentOptions,
  {
    codegenDirUrl,
    root,
  }: {
    codegenDirUrl: URL;
    root: URL;
  },
): ResolvedIntegrationOptions {
  const collections = Array.isArray(userOptions?.collections)
    ? userOptions.collections
    : [];
  if (collections.length === 0) {
    throw new Error(
      "astroRelatedContent requires at least one configured collection.",
    );
  }

  const rootDir = resolvePath(fileURLToPath(root), userOptions.rootDir);
  const codegenDir = userOptions.codegenDir
    ? resolvePath(rootDir, userOptions.codegenDir)
    : fileURLToPath(codegenDirUrl);
  const generation = {
    cacheDir: resolvePath(
      codegenDir,
      userOptions.generation?.cacheDir ?? join("cache"),
    ),
    limit: userOptions.generation?.limit ?? 5,
    watch: userOptions.generation?.watch ?? true,
  };
  const embeddings: EmbeddingsInput = {
    ...(userOptions.embeddings ?? {}),
  };

  requirePositiveInteger("generation.limit", generation.limit);
  requirePositiveInteger("embeddings.batchSize", embeddings.batchSize ?? 1);

  return {
    codegenDir,
    collections: resolveCollections(rootDir, collections),
    dataModulePath: join(codegenDir, "data.mjs"),
    embeddings: {
      batchSize: embeddings.batchSize ?? 1,
      input: embeddings,
      provider: resolveProvider(embeddings),
    },
    generation,
    rootDir,
    runtimeModulePath: join(codegenDir, "runtime.mjs"),
    vectorCachePath: join(generation.cacheDir, "vectors.json"),
  };
}
