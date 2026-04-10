import type { RelatedContentData } from "./types.ts";
import { stableStringify } from "./serialize.ts";

export function buildRuntimeDataModule(data: RelatedContentData): string {
  return `export const relatedContentData = ${stableStringify(data)};\n`;
}

export function buildRuntimeModule(): string {
  return `import { getCollection } from "astro:content";
import { relatedContentData } from "./data.mjs";

function normalizeCollectionEntryId(id) {
  return String(id).replace(/\\.(md|mdx)$/, "");
}

export function getRelatedContentMatches(collection, id) {
  const collectionData = relatedContentData[collection];
  if (!collectionData) {
    return [];
  }

  const matches = collectionData[id];
  return Array.isArray(matches) ? matches.map((match) => ({ ...match })) : [];
}

export function getRelatedContentIds(collection, id) {
  return getRelatedContentMatches(collection, id).map((match) => match.id);
}

export async function getRelatedContent(collection, id) {
  const matches = getRelatedContentMatches(collection, id);
  const entries = await getCollection(collection);
  const entryById = new Map(
    entries.flatMap((entry) => {
      const normalizedId = normalizeCollectionEntryId(entry.id);
      return normalizedId === entry.id
        ? [[entry.id, entry]]
        : [[entry.id, entry], [normalizedId, entry]];
    }),
  );

  return matches.flatMap((match) => {
    const entry = entryById.get(match.id);
    return entry ? [{ entry, score: match.score }] : [];
  });
}
`;
}
