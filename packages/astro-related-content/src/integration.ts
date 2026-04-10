import { access } from "node:fs/promises";

import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";

import {
  INTEGRATION_NAME,
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from "./constants.ts";
import { generateRelatedContent } from "./generator.ts";
import { resolveIntegrationOptions } from "./options.ts";
import { buildInjectedTypes } from "./runtime-types.ts";
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

function createViteVirtualModulePlugin(state: IntegrationState): Plugin {
  return {
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID || !state.options) {
        return undefined;
      }

      await access(state.options.runtimeModulePath);
      return `export * from ${JSON.stringify(
        `/@fs/${toPosixPath(state.options.runtimeModulePath)}`,
      )};`;
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
      "astro:config:done"({ injectTypes }) {
        injectTypes({
          content: buildInjectedTypes(),
          filename: "astro-related-content.d.ts",
        });
      },
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
