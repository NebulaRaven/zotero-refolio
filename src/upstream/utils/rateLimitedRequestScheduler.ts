  // src/utils/rateLimitedRequestScheduler.ts
  export class RateLimitedRequestScheduler {
    declare intervalMs: any;
    declare clock: any;
    declare schedule: Promise<void>;
    declare inFlight: Map<any, any>;
    declare lastStart: any;

    constructor(intervalMs, clock) {
      this.intervalMs = intervalMs;
      this.clock = clock;
      this.schedule = Promise.resolve();
      this.inFlight = /* @__PURE__ */new Map();
    }
    run(key, requestFactory) {
      const existing = this.inFlight.get(key);
      if (existing) {
        return existing;
      }
      let resolveRequest;
      let rejectRequest;
      const result = new Promise<unknown>((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      });
      this.inFlight.set(key, result);
      const clear = () => {
        if (this.inFlight.get(key) === result) {
          this.inFlight.delete(key);
        }
      };
      result.then(clear, clear);
      this.schedule = this.schedule.catch(() => undefined).then(async () => {
        try {
          if (this.lastStart !== undefined) {
            const waitTime = Math.max(0, this.lastStart + this.intervalMs - this.clock.now());
            if (waitTime > 0) {
              await this.clock.delay(waitTime);
            }
          }
          this.lastStart = this.clock.now();
          Promise.resolve().then(requestFactory).then(resolveRequest, rejectRequest);
        } catch (error) {
          rejectRequest(error);
        }
      });
      return result;
    }
  };

