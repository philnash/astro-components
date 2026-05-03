import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";

import { createEmbeddingProvider } from "./provider.ts";
import type {
  EmbeddingProvider,
  TransformersEmbeddingsOptions,
} from "../types.ts";

type TransformersResolvedOptions = Required<
  Pick<
    TransformersEmbeddingsOptions,
    "device" | "dtype" | "model" | "modelCacheDir" | "pooling"
  >
> & {
  batchSize: number;
};

type TransformersFeatureExtractionOutput = {
  data: ArrayLike<number>;
  dims: number[];
};

type TransformersExtractor = (
  texts: string[],
  options: {
    normalize: boolean;
    pooling: string;
  },
) => Promise<TransformersFeatureExtractionOutput>;

type TransformersModule = {
  env: {
    cacheDir: string;
  };
  pipeline: (
    task: "feature-extraction",
    model: string,
    options: {
      device: string;
      dtype: string;
    },
  ) => Promise<TransformersExtractor>;
};

const require = createRequire(import.meta.url);

let transformersModulePromise: Promise<TransformersModule> | undefined;
const extractorPromises = new Map<string, Promise<TransformersExtractor>>();

async function loadTransformersModule(): Promise<TransformersModule> {
  transformersModulePromise ??= Promise.resolve(
    require("@huggingface/transformers") as TransformersModule,
  );
  return transformersModulePromise;
}

function createExtractorCacheKey(options: TransformersResolvedOptions): string {
  return JSON.stringify({
    device: options.device,
    dtype: options.dtype,
    model: options.model,
  });
}

function resolveModelCacheDir(rootDir: string, modelCacheDir?: string): string {
  if (!modelCacheDir) {
    return join(rootDir, ".astro", "astro-related-content", "models");
  }

  return isAbsolute(modelCacheDir)
    ? modelCacheDir
    : resolve(rootDir, modelCacheDir);
}

async function getExtractor(
  options: TransformersResolvedOptions,
): Promise<TransformersExtractor> {
  const key = createExtractorCacheKey(options);
  let extractorPromise = extractorPromises.get(key);

  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { env, pipeline } = await loadTransformersModule();
      env.cacheDir = options.modelCacheDir;
      return pipeline("feature-extraction", options.model, {
        device: options.device,
        dtype: options.dtype,
      });
    })();
    extractorPromises.set(key, extractorPromise);
  }

  return extractorPromise;
}

export function createTransformersEmbeddingProvider(): EmbeddingProvider<
  TransformersResolvedOptions,
  TransformersEmbeddingsOptions
> {
  return createEmbeddingProvider({
    async embed(texts, options) {
      const extractor = await getExtractor(options);
      const output = (await extractor(texts, {
        normalize: true,
        pooling: options.pooling,
      })) as TransformersFeatureExtractionOutput;
      const dimension = output.dims.at(-1);

      if (!dimension) {
        throw new Error("Transformers provider returned an invalid embedding shape.");
      }

      const vectors: number[][] = [];

      for (let index = 0; index < texts.length; index += 1) {
        const start = index * dimension;
        const end = start + dimension;
        vectors.push(Array.from(output.data.slice(start, end)));
      }

      return vectors;
    },
    getMetadata(options) {
      return {
        device: options.device,
        dtype: options.dtype,
        model: options.model,
        pooling: options.pooling,
      };
    },
    name: "transformers",
    resolveOptions(embeddings, context) {
      return {
        batchSize: embeddings.batchSize ?? 1,
        device: embeddings.device ?? "cpu",
        dtype: embeddings.dtype ?? "fp32",
        model: embeddings.model ?? "Xenova/all-MiniLM-L6-v2",
        modelCacheDir: resolveModelCacheDir(
          context.rootDir,
          embeddings.modelCacheDir,
        ),
        pooling: embeddings.pooling ?? "mean",
      };
    },
    version: "1",
  });
}
