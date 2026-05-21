import { readFile } from "node:fs/promises";

import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";

import {
  INTEGRATION_NAME,
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from "./constants.ts";
import { generateRelatedContent } from "./generator.ts";
import { resolveIntegrationOptions } from "./options.ts";
import { createGenerationScheduler } from "./scheduler.ts";
import { toPosixPath } from "./serialize.ts";
import type {
  AstroRelatedContentOptions,
  GenerationScheduler,
  ResolvedIntegrationOptions,
  ResolvedRelatedContentCollection,
} from "./types.ts";

type IntegrationState = {
  options?: ResolvedIntegrationOptions;
  scheduler?: GenerationScheduler;
};

const virtualModuleTypesUrl = new URL("../virtual-module.d.ts", import.meta.url);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isContentFile(
  filePath: string,
  collections: ResolvedRelatedContentCollection[],
): boolean {
  return (
    (filePath.endsWith(".md") || filePath.endsWith(".mdx")) &&
    collections.some((collection) =>
      toPosixPath(filePath).startsWith(toPosixPath(collection.dir)),
    )
  );
}

function buildVirtualModuleSource(dataFilePath: string): string {
  return `import { getCollection } from "astro:content";
import relatedContentData from ${JSON.stringify(
    `/@fs/${toPosixPath(dataFilePath)}`,
  )};

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

function createViteVirtualModulePlugin(state: IntegrationState): Plugin {
  return {
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID || !state.options) {
        return undefined;
      }

      return buildVirtualModuleSource(state.options.dataFilePath);
    },
    name: `${INTEGRATION_NAME}:virtual-module`,
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }

      return undefined;
    },
  };
}

export function createIntegration(
  userOptions: AstroRelatedContentOptions,
): AstroIntegration {
  const state: IntegrationState = {};

  return {
    hooks: {
      async "astro:config:setup"(params) {
        state.options = resolveIntegrationOptions(userOptions, {
          codegenDirUrl: params.createCodegenDir(),
          root: params.config.root,
        });
        state.scheduler = createGenerationScheduler(
          async () => {
            await generateRelatedContent(state.options!, {
              logger(message) {
                params.logger.info(message);
              },
            });
          },
          {
            delayMs: 75,
            onWatchError(error) {
              params.logger.error(
                `astro-related-content regeneration failed: ${getErrorMessage(error)}`,
              );
            },
          },
        );

        params.updateConfig({
          vite: {
            plugins: [createViteVirtualModulePlugin(state)],
          },
        });

        await state.scheduler.runNow({ isWatch: false });
      },
      async "astro:config:done"({ injectTypes }) {
        injectTypes({
          content: await readFile(virtualModuleTypesUrl, "utf8"),
          filename: "virtual-module.d.ts",
        });
      },
      "astro:server:setup"({ logger, server }) {
        if (!state.options?.generation.watch || !state.scheduler) {
          return;
        }

        const watchedDirectories = state.options.collections.map(
          (collection) => collection.dir,
        );
        server.watcher.add(watchedDirectories);

        const handleFileEvent = (filePath: string): void => {
          if (!isContentFile(filePath, state.options!.collections)) {
            return;
          }

          state.scheduler!
            .schedule({ isWatch: true })
            .then(() => {
              server.ws.send({ type: "full-reload" });
            })
            .catch((error: unknown) => {
              logger.error(
                `astro-related-content regeneration failed: ${getErrorMessage(error)}`,
              );
            });
        };

        server.watcher.on("add", handleFileEvent);
        server.watcher.on("change", handleFileEvent);
        server.watcher.on("unlink", handleFileEvent);
      },
    },
    name: INTEGRATION_NAME,
  };
}
