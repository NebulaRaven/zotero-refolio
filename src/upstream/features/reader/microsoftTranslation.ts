  // src/features/reader/microsoftTranslation.ts
  export function encodeMicrosoftTranslationText(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  export function decodeMicrosoftTranslationText(text) {
    const namedEntities = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      quot: "\""
    };
    return text.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hexadecimal, named) => {
      if (named) {
        return namedEntities[named.toLowerCase()] ?? entity;
      }
      const codePoint = Number.parseInt(decimal || hexadecimal, hexadecimal ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint > 1114111) {
        return entity;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    });
  }
  export function buildMicrosoftTranslationRequest(text, sourceLanguage, targetLanguage) {
    const source = /^(?:auto(?:-detect)?)?$/i.test(sourceLanguage) ? "" : sourceLanguage;
    return {
      url: `https://edge.microsoft.com/translate/translatetext?from=${encodeURIComponent(source)}&to=${encodeURIComponent(targetLanguage)}&isEnterpriseClient=false`,
      body: JSON.stringify([encodeMicrosoftTranslationText(text)])
    };
  }
  export function parseMicrosoftTranslationResponse(response) {
    let data = response;
    if (typeof response === "string") {
      try {
        data = JSON.parse(response);
      } catch {
        return undefined;
      }
    }
    if (!Array.isArray(data)) {
      return undefined;
    }
    const text = data[0]?.translations?.[0]?.text;
    if (typeof text !== "string" || !text) {
      return undefined;
    }
    return decodeMicrosoftTranslationText(text);
  }

