import { spRedactURL } from "../../core/journals.ts";
  // src/utils/requests.ts
  export class Requests {
    declare maxCacheEntries: number;
    declare cache: Record<string, any>;
    declare cacheKeys: string[];

    constructor(maxCacheEntries = 100) {
      this.maxCacheEntries = maxCacheEntries;
      /**
       * Record api response
       */
      this.cache = {};
      this.cacheKeys = [];
    }
    readCache(key) {
      if (!Object.prototype.hasOwnProperty.call(this.cache, key)) {
        return {
          hit: false
        };
      }
      const index = this.cacheKeys.indexOf(key);
      if (index >= 0) {
        this.cacheKeys.splice(index, 1);
        this.cacheKeys.push(key);
      }
      return {
        hit: true,
        value: this.cache[key]
      };
    }
    writeCache(key, value) {
      if (this.maxCacheEntries <= 0) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(this.cache, key)) {
        while (this.cacheKeys.length >= this.maxCacheEntries) {
          const expiredKey = this.cacheKeys.shift();
          if (expiredKey !== undefined) {
            delete this.cache[expiredKey];
          }
        }
        this.cacheKeys.push(key);
      }
      this.cache[key] = value;
    }
    async get(url, responseType = "json", headers = {}, throwOnError = false) {
      const k = JSON.stringify([url, responseType, headers]);
      const cached = this.readCache(k);
      if (cached.hit) {
        return cached.value;
      }
      try {
        const res = await Zotero.HTTP.request("GET", url, {
          responseType,
          headers
        });
        if (res.status == 200) {
          this.writeCache(k, res.response);
          return res.response;
        } else {
          const error = Object.assign(new Error(`HTTP ${res.status}`), {
            status: res.status,
            response: res
          });
          Zotero.debug(`get ${spRedactURL(url)} error`);
          ztoolkit.log(`get ${spRedactURL(url)} error`, res.status);
          if (throwOnError) {
            throw error;
          }
        }
      } catch (error) {
        if (throwOnError) {
          throw error;
        }
        return {};
      }
    }
    async post(url, body = {}, responseType = "json") {
      const k = JSON.stringify([url, body, responseType]);
      const cached = this.readCache(k);
      if (cached.hit) {
        return cached.value;
      }
      const res = await Zotero.HTTP.request("POST", url, Object.assign({
        responseType
      }, Object.keys(body).length > 0 ? {
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
        // credentials: "include"
      } : {}));
      if (res.status == 200) {
        this.writeCache(k, res.response);
        return res.response;
      } else {
        ztoolkit.log(`post ${spRedactURL(url)} error`, res.status);
      }
    }
  };

