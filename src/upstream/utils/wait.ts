  // src/utils/wait.ts
  export function waitUtilAsync2(condition, interval = 100, timeout = 10000) {
    return new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const intervalId = ztoolkit.getGlobal("setInterval")(() => {
        try {
          if (condition()) {
            ztoolkit.getGlobal("clearInterval")(intervalId);
            resolve();
          } else if (Date.now() - start > timeout) {
            ztoolkit.getGlobal("clearInterval")(intervalId);
            reject();
          }
        } catch (error) {
          ztoolkit.getGlobal("clearInterval")(intervalId);
          reject(error);
        }
      }, interval);
    });
  }

