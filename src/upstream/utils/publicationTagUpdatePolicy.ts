  // src/utils/publicationTagUpdatePolicy.ts
  export function getPublicationTagNotificationPolicy(trigger) {
    return {
      showError: trigger === "context-menu",
      showResult: trigger !== "automatic"
    };
  }

