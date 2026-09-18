  // src/features/reader/tldrLogic.ts
  export function getTldrTextFromResponse(response) {
    if (!response || typeof response !== "object") {
      return "";
    }
    const tldr = response.tldr;
    if (!tldr || typeof tldr !== "object") {
      return "";
    }
    const text = tldr.text;
    if (typeof text === "string") {
      return text;
    } else {
      return "";
    }
  }
  export function getSuccessfulTldrTranslation(response) {
    if (response.status !== "success" || typeof response.result !== "string") {
      return undefined;
    }
    const result = response.result.trim();
    return result || undefined;
  }
  export async function prepareTldrText(sourceText, options) {
    if (!sourceText.trim()) {
      return "";
    }
    let text = sourceText;
    if (options.autoTranslate && options.translate) {
      try {
        const response = await options.translate(sourceText);
        text = getSuccessfulTldrTranslation(response) ?? sourceText;
      } catch (error) {
        options.onTranslationError?.(error);
      }
    }
    await options.persist(text);
    return text;
  }

