import { createHash } from "node:crypto";

import { createEmbeddingProvider } from "./provider.ts";
import type { EmbeddingProvider } from "../types.ts";

export type FixtureEmbeddingProviderOptions = {
  dimensions?: number;
  onEmbed?: (texts: string[]) => void;
  salt?: string;
  version?: string;
};

type FixtureResolvedOptions = {
  dimensions: number;
  onEmbed?: (texts: string[]) => void;
  salt: string;
};

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function createDeterministicVector(
  text: string,
  options: FixtureResolvedOptions,
): number[] {
  const vector = Array.from({ length: options.dimensions }, () => 0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (const token of tokens) {
    const digest = createHash("sha256")
      .update(`${options.salt}:${token}`)
      .digest();
    const bucket = digest.readUInt32BE(0) % options.dimensions;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }

  return vector;
}

export function createFixtureEmbeddingProvider(
  {
    dimensions = 24,
    onEmbed,
    salt = "astro-related-content-fixture",
    version = "1",
  }: FixtureEmbeddingProviderOptions = {},
): EmbeddingProvider<FixtureResolvedOptions> {
  return createEmbeddingProvider({
    async embed(texts, options) {
      if (typeof options.onEmbed === "function") {
        options.onEmbed(texts);
      }

      return texts.map((text) => createDeterministicVector(text, options));
    },
    getMetadata(options) {
      return {
        dimensions: options.dimensions,
        salt: options.salt,
      };
    },
    name: "fixture",
    resolveOptions() {
      return { dimensions, onEmbed, salt };
    },
    version,
  });
}
