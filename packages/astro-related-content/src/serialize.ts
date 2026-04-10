import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function stableSortObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableSortObject(nestedValue)]),
    ) as T;
  }

  return value;
}

export function stableStringify(value: unknown, spacing = 2): string {
  return JSON.stringify(stableSortObject(value), null, spacing);
}

export async function writeFileAtomic(
  filePath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const temporaryFilePath = `${filePath}.tmp`;
  await writeFile(temporaryFilePath, contents, "utf8");
  await rename(temporaryFilePath, filePath);
}

export function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
