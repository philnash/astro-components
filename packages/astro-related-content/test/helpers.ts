import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export async function createTempDirectory(
  prefix = "astro-related-content-",
): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function writeFiles(
  rootDir: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = join(rootDir, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }
}

export async function removeDirectory(directoryPath: string): Promise<void> {
  await rm(directoryPath, { force: true, recursive: true });
}

export async function importFresh<T>(modulePath: string): Promise<T> {
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`) as Promise<T>;
}
