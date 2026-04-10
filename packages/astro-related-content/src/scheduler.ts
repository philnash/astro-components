import type {
  GenerationRequest,
  GenerationScheduler,
} from "./types.ts";

type Waiter = {
  reject: (error?: unknown) => void;
  resolve: () => void;
};

function mergeContexts(
  left: Partial<GenerationRequest> | undefined,
  right: Partial<GenerationRequest> | undefined,
): Partial<GenerationRequest> {
  if (!left) {
    return { ...right };
  }

  if (!right) {
    return { ...left };
  }

  return {
    ...left,
    ...right,
    isWatch: Boolean(left.isWatch || right.isWatch),
  };
}

export function createGenerationScheduler(
  task: (context: GenerationRequest) => Promise<void>,
  {
    delayMs = 50,
    onWatchError,
  }: {
    delayMs?: number;
    onWatchError?: (error: unknown) => void;
  } = {},
): GenerationScheduler {
  let timer: NodeJS.Timeout | undefined;
  let pendingContext: Partial<GenerationRequest> | undefined;
  let running = false;
  let runningPromise: Promise<void> = Promise.resolve();
  let scheduledWaiters: Waiter[] = [];

  function settleScheduledWaiters(error?: unknown): void {
    const waiters = scheduledWaiters;
    scheduledWaiters = [];

    for (const waiter of waiters) {
      if (error) {
        waiter.reject(error);
      } else {
        waiter.resolve();
      }
    }
  }

  async function consumeQueue(): Promise<void> {
    if (running) {
      return runningPromise;
    }

    running = true;
    runningPromise = (async () => {
      while (pendingContext) {
        const context: GenerationRequest = {
          isWatch: Boolean(pendingContext.isWatch),
        };
        pendingContext = undefined;

        try {
          await task(context);
        } catch (error) {
          if (context.isWatch && typeof onWatchError === "function") {
            onWatchError(error);
          } else {
            throw error;
          }
        }
      }
    })();

    try {
      await runningPromise;
    } finally {
      running = false;
    }
  }

  function enqueue(context: Partial<GenerationRequest>): Promise<void> {
    pendingContext = mergeContexts(pendingContext, context);
    return consumeQueue();
  }

  return {
    runNow(context = {}) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      return enqueue(context).then(
        () => {
          settleScheduledWaiters();
        },
        (error) => {
          settleScheduledWaiters(error);
          throw error;
        },
      );
    },
    schedule(context = {}) {
      pendingContext = mergeContexts(pendingContext, context);

      return new Promise<void>((resolve, reject) => {
        scheduledWaiters.push({ reject, resolve });

        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(() => {
          timer = undefined;
          consumeQueue().then(
            () => {
              settleScheduledWaiters();
            },
            (error) => {
              settleScheduledWaiters(error);
            },
          );
        }, delayMs);
      });
    },
  };
}
