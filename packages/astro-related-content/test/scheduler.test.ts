import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGenerationScheduler } from "../src/scheduler.ts";

function wait(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time));
}

describe("createGenerationScheduler", () => {
  it("serializes overlapping generations and coalesces follow-up runs", async () => {
    let runCount = 0;
    const scheduler = createGenerationScheduler(
      async () => {
        runCount += 1;
        await wait(25);
      },
      { delayMs: 10 },
    );

    const firstRun = scheduler.runNow({ isWatch: false });
    await wait(1);
    const secondRun = scheduler.schedule({ isWatch: true });
    const thirdRun = scheduler.schedule({ isWatch: true });

    await Promise.all([firstRun, secondRun, thirdRun]);

    assert.equal(runCount, 2);
  });
});
