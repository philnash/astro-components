declare module "virtual:astro-related-content" {
  export type RelatedContentMatch =
    import("@philnash/astro-related-content").RelatedContentMatch;
  export type RelatedContentResult<
    C extends import("astro:content").CollectionKey,
  > = {
    entry: import("astro:content").CollectionEntry<C>;
    score: number;
  };
  export function getRelatedContent<
    C extends import("astro:content").CollectionKey,
  >(collection: C, id: string): Promise<RelatedContentResult<C>[]>;
  export function getRelatedContentIds(collection: string, id: string): string[];
  export function getRelatedContentMatches(
    collection: string,
    id: string,
  ): RelatedContentMatch[];
}
