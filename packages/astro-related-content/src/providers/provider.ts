import type { EmbeddingProvider, EmbeddingsInput } from "../types.ts";

export function createEmbeddingProvider<
  TOptions = Record<string, unknown>,
  TInput extends EmbeddingsInput = EmbeddingsInput,
>(
  definition: EmbeddingProvider<TOptions, TInput>,
): EmbeddingProvider<TOptions, TInput> {
  if (!definition || typeof definition !== "object") {
    throw new Error("Expected an embedding provider definition object.");
  }

  if (typeof definition.name !== "string" || definition.name.length === 0) {
    throw new Error("Embedding providers must define a non-empty name.");
  }

  if (typeof definition.version !== "string" || definition.version.length === 0) {
    throw new Error("Embedding providers must define a non-empty version.");
  }

  if (typeof definition.embed !== "function") {
    throw new Error(
      "Embedding providers must define an embed(texts, options, context) function.",
    );
  }

  return Object.freeze({
    getMetadata: () => ({}),
    resolveOptions: ((embeddings: TInput) => embeddings as unknown as TOptions),
    ...definition,
  });
}
