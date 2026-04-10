import { PACKAGE_NAME, VIRTUAL_MODULE_ID } from "./constants.ts";

export function buildInjectedTypes(): string {
  return `declare module "${VIRTUAL_MODULE_ID}" {
  import type { CollectionEntry, CollectionKey } from "astro:content";
  export type RelatedContentMatch = import("${PACKAGE_NAME}").RelatedContentMatch;
  export type RelatedContentResult<C extends CollectionKey> = {
    entry: CollectionEntry<C>;
    score: number;
  };
  export function getRelatedContent<C extends CollectionKey>(collection: C, id: string): Promise<RelatedContentResult<C>[]>;
  export function getRelatedContentIds(collection: string, id: string): string[];
  export function getRelatedContentMatches(collection: string, id: string): RelatedContentMatch[];
}
`;
}
