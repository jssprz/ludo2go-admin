type GoogleTranslateResponse = {
  data?: {
    translations?: Array<{
      translatedText?: string;
    }>;
  };
  error?: {
    message?: string;
  };
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function translateText(
  text: string,
  targetLanguage = 'es',
  sourceLanguage = 'en'
): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATION_API_KEY;
  const input = text.trim();

  if (!input) return text;
  if (!apiKey) return text;

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: input,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text',
        }),
      }
    );

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as GoogleTranslateResponse | null;
      console.error('Google Translate API error', {
        status: response.status,
        message: errorPayload?.error?.message,
      });
      return text;
    }

    const payload = (await response.json()) as GoogleTranslateResponse;
    const translated = payload.data?.translations?.[0]?.translatedText;

    if (!translated) return text;
    return decodeHtmlEntities(translated);
  } catch (error) {
    console.error('Failed to translate text with Google Translate API', error);
    return text;
  }
}