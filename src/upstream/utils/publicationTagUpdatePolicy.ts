  // src/utils/publicationTagUpdatePolicy.ts
  export function getPublicationTagNotificationPolicy(trigger) {
    return {
      showError: trigger === "context-menu",
      showResult: trigger !== "automatic"
    };
  }
  // Item-tree renders start an automatic lookup for every journal without stored ranks, so a
  // journal whose lookup failed, or a provider that refused or throttled us, would otherwise be
  // requested again on every render.
  export class PublicationTagUpdateBackoff {
    declare retryDelayMs: number;
    declare providerPauseMs: number;
    declare clock: { now(): number };
    declare retryAt: Map<string, number>;
    declare pausedUntil: Map<string, number>;

    constructor(retryDelayMs, providerPauseMs, clock) {
      this.retryDelayMs = retryDelayMs;
      this.providerPauseMs = providerPauseMs;
      this.clock = clock;
      this.retryAt = new Map();
      this.pausedUntil = new Map();
    }
    allows(query) {
      const now = this.clock.now();
      return !this.waiting(this.pausedUntil, query.provider, now) && !this.waiting(this.retryAt, query.identity, now);
    }
    waiting(until, key, now) {
      const time = until.get(key);
      if (time === undefined) {
        return false;
      }
      if (time > now) {
        return true;
      }
      until.delete(key);
      return false;
    }
    recordFailure(query) {
      this.retryAt.set(query.identity, this.clock.now() + this.retryDelayMs);
    }
    recordSuccess(query) {
      this.retryAt.delete(query.identity);
    }
    recordProviderStatus(provider, status) {
      // A rejected key, a block (shown to users as a rate limit) or throttling affects every journal.
      if (status === 401 || status === 403 || status === 429) {
        this.pausedUntil.set(provider, this.clock.now() + this.providerPauseMs);
      }
    }
  };

