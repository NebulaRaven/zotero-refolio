import type { Cleanup,FeatureFailure } from '../../types/addon.ts';
  // src/app/lifecycle.ts
  export class FeatureRuntime {
    declare context: any;
    declare onFailure: (failure: FeatureFailure) => void;
    declare startedFeatures: Map<string, Cleanup>;
    declare startingFeatureIDs: Set<string>;
    declare inFlightStarts: Set<Promise<string>>;
    declare shutdownController: AbortController;
    declare stopped: boolean;

    constructor(context, onFailure: (failure: FeatureFailure) => void = () => {}) {
      this.context = context;
      this.onFailure = onFailure;
      this.startedFeatures = /* @__PURE__ */new Map();
      this.startingFeatureIDs = /* @__PURE__ */new Set();
      this.inFlightStarts = /* @__PURE__ */new Set();
      this.shutdownController = new AbortController();
      this.stopped = false;
    }
    get shutdownSignal() {
      return this.shutdownController.signal;
    }
    start(feature) {
      if (this.stopped) {
        return Promise.resolve("skipped");
      }
      if (this.startedFeatures.has(feature.id) || this.startingFeatureIDs.has(feature.id)) {
        return Promise.resolve("already-started");
      }
      this.startingFeatureIDs.add(feature.id);
      const start = this.startFeature(feature);
      this.inFlightStarts.add(start);
      start.then(() => {
        this.inFlightStarts.delete(start);
        this.startingFeatureIDs.delete(feature.id);
      });
      return start;
    }
    async startFeature(feature) {
      try {
        if (feature.isEnabled && !(await feature.isEnabled(this.context))) {
          return "skipped";
        }
        if (this.stopped) {
          return "skipped";
        }
        const cleanup = await feature.start(this.context);
        if (this.stopped) {
          if (cleanup) {
            await this.stopFeature(feature.id, cleanup);
          }
          return "skipped";
        }
        this.startedFeatures.set(feature.id, cleanup || undefined);
        return "started";
      } catch (error) {
        this.onFailure({
          featureID: feature.id,
          phase: "start",
          error
        });
        return "failed";
      }
    }
    async startAll(features) {
      const results = [];
      for (const feature of features) {
        results.push(await this.start(feature));
      }
      return results;
    }
    async stopAll() {
      this.stopped = true;
      this.shutdownController.abort();
      const startedFeatures = [...this.startedFeatures.entries()].reverse();
      this.startedFeatures.clear();
      for (const [featureID, cleanup] of startedFeatures) {
        if (!cleanup) {
          continue;
        }
        await this.stopFeature(featureID, cleanup);
      }
      await Promise.all(this.inFlightStarts);
    }
    async stopFeature(featureID, cleanup) {
      try {
        await cleanup();
      } catch (error) {
        this.onFailure({
          featureID,
          phase: "stop",
          error
        });
      }
    }
  };

