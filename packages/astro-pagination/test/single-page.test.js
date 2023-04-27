import { describe, it, before } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as cheerio from "cheerio";
import assert from "node:assert";

const demoPath = join("..", "..", "demo", "dist");

describe("pagination with only a single page", () => {
  let $, nav;
  before(async () => {
    const html = await readFile(join(demoPath, "single-page", "index.html"), {
      encoding: "utf-8",
    });
    $ = cheerio.load(html);
    nav = $("nav[role=navigation][aria-label='Pagination']");
  });

  it("has a nav element with role of navigation and an aria-label", () => {
    assert.strictEqual(nav.length, 1);
  });
});
