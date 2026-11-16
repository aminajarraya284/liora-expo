/** Écrit dans l'ordre, conserve le dernier état en échec et permet de réessayer. */
export function createSaver<Job>(write: (job: Job) => Promise<void>, onError: (failed: boolean) => void = () => {}) {
  let pending: { job: Job } | null = null;
  let running: Promise<void> | null = null;
  let failure: unknown = null;
  let failed = false;
  let generation = 0;

  const start = (): Promise<void> => {
    running ??= Promise.resolve().then(async () => {
      while (pending) {
        const next = pending;
        const currentGeneration = generation;
        pending = null;
        try {
          await write(next.job);
          if (generation === currentGeneration) {
            failure = null;
            failed = false;
            onError(false);
          }
        } catch (error) {
          if (generation === currentGeneration) {
            pending ??= next;
            failure = error;
            failed = true;
            onError(true);
          }
          break;
        }
      }
    }).finally(() => { running = null; });
    return running;
  };

  return {
    schedule(job: Job): void {
      pending = { job };
      void start();
    },
    async flush(): Promise<void> {
      if (running) await running;
      if (pending) await start();
      if (failed) throw failure;
    },
    cancel(): void {
      generation += 1;
      pending = null;
      failure = null;
      failed = false;
      onError(false);
    },
  };
}
