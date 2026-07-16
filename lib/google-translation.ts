type GoogleTranslateResponse = {
  data?: {
    translations?: Array<{
      translatedText?: string;
      detectedSourceLanguage?: string;
      model?: string;
    }>;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{
      message?: string;
      domain?: string;
      reason?: string;
    }>;
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
  sourceLanguage?: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATION_API_KEY;
  const resolvedApiKey = apiKey?.trim();
  const input = text.trim();

  if (!input) return text;
  if (!resolvedApiKey) return text;
  const apiKeyValue: string = resolvedApiKey;

  async function runTranslateRequest() {
    const queryParams = new URLSearchParams({ key: apiKeyValue });
    const bodyParams = new URLSearchParams({
      q: input,
      target: targetLanguage,
      format: 'text',
    });

    if (sourceLanguage) {
      bodyParams.set('source', sourceLanguage);
    }

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${queryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: bodyParams.toString(),
      }
    );

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as GoogleTranslateResponse | null;
      const firstError = errorPayload?.error?.errors?.[0];
      console.error('Google Translate API error', {
        status: response.status,
        statusText: response.statusText,
        code: errorPayload?.error?.code,
        apiStatus: errorPayload?.error?.status,
        message: errorPayload?.error?.message,
        reason: firstError?.reason,
        domain: firstError?.domain,
      });
      throw new Error(errorPayload?.error?.message || `HTTP ${response.status}`);
    }

    const payload = (await response.json()) as GoogleTranslateResponse;
    const translated = payload.data?.translations?.[0]?.translatedText;

    if (!translated) return text;
    return decodeHtmlEntities(translated);
  }

  try {
    return await runTranslateRequest();
  } catch (error) {
    try {
      return await runTranslateRequest();
    } catch (retryError) {
      console.error('Failed to translate text with Google Translate API', {
        error,
        retryError,
      });
      return text;
    }
  }
}