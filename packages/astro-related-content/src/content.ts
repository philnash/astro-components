import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";

import matter from "gray-matter";
import { glob } from "tinyglobby";

import { markdownToPlainText } from "./markdown.ts";
import { toPosixPath } from "./serialize.ts";
import type { ContentItem, ResolvedRelatedContentCollection } from "./types.ts";

function createHashDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortContentItems(items: ContentItem[]): ContentItem[] {
  return items.sort((left, right) => {
    if (left.collection !== right.collection) {
      return left.collection.localeCompare(right.collection);
    }

    return left.id.localeCompare(right.id);
  });
}

function createSemanticInput(title: string, bodyText: string): string {
  return [title.trim(), bodyText].filter(Boolean).join("\n\n").trim();
}

export async function readContentSources(
  collections: ResolvedRelatedContentCollection[],
): Promise<ContentItem[]> {
  const items: ContentItem[] = [];

  for (const collection of collections) {
    const patterns =
      collection.include.length > 0 ? collection.include : ["**/*.md", "**/*.mdx"];
    const matchedFiles = await glob(patterns, {
      absolute: true,
      caseSensitiveMatch: true,
      cwd: collection.dir,
      onlyFiles: true,
    });
    const seenIds = new Set<string>();

    for (const filePath of matchedFiles.sort()) {
      const extension = extname(filePath);
      if (extension !== ".md" && extension !== ".mdx") {
        continue;
      }

      const rawDocument = await readFile(filePath, "utf8");
      const parsedDocument = matter(rawDocument);
      const title = parsedDocument.data.title;

      if (typeof title !== "string" || title.trim().length === 0) {
        throw new Error(
          `Content item "${filePath}" is missing a required frontmatter title.`,
        );
      }

      const relativePath = toPosixPath(relative(collection.dir, filePath));
      const id = relativePath.slice(0, -extension.length);

      if (seenIds.has(id)) {
        throw new Error(
          `Collection "${collection.collection}" contains duplicate content id "${id}".`,
        );
      }

      seenIds.add(id);

      const bodyText = markdownToPlainText(parsedDocument.content);
      const semanticInput = createSemanticInput(title, bodyText);

      items.push({
        bodyText,
        collection: collection.collection,
        filePath,
        hash: createHashDigest(semanticInput),
        id,
        semanticInput,
        title: title.trim(),
      });
    }
  }

  return sortContentItems(items);
}
