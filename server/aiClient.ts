import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const DEFAULT_AI_MODEL = 'gemini-4-hydrogen';

// Models that reject temperature / topP / topK
const NO_SAMPLING_PARAM_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-neon',
  'gemini-4-argon',
  'gemini-4-carbon'
]);

export function isVertexAiProvider(): boolean {
  return (process.env.AI_PROVIDER || '').trim().toLowerCase() === 'vertex';
}

export function getAiApiKey(): string {
  return (process.env.DRIFT_JUDGE_API_KEY || process.env.GEMINI_API_KEY || '').trim();
}

export function isAiClientConfigured(): boolean {
  if (isVertexAiProvider()) {
    return true;
  }
  return Boolean(getAiApiKey());
}

export function getAiModel(overrideModel?: string): string {
  const configured = (
    overrideModel ||
    process.env.AI_MODEL ||
    process.env.DRIFT_JUDGE_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_AI_MODEL
  ).trim();
  return configured || DEFAULT_AI_MODEL;
}

export function getCandidateAiModels(overrideModel?: string): string[] {
  const primary = getAiModel(overrideModel);
  const explicitAiModel = (overrideModel || process.env.AI_MODEL || '').trim();
  if (explicitAiModel) {
    return [explicitAiModel];
  }
  return Array.from(
    new Set(
      [
        primary,
        DEFAULT_AI_MODEL,
        'gemini-3.1-flash-lite'
      ].filter(Boolean)
    )
  );
}

/**
 * Shared factory for creating the GoogleGenAI client instance.
 * - If AI_PROVIDER=vertex, initializes with { vertexai: true, project, location } and NO API key.
 * - Otherwise initializes with the configured API key (DRIFT_JUDGE_API_KEY || GEMINI_API_KEY).
 */
export function getSharedAiClient(customApiKey?: string): GoogleGenAI {
  if (isVertexAiProvider()) {
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global'
    });
  }

  const apiKey = (customApiKey || getAiApiKey()).trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key (DRIFT_JUDGE_API_KEY / GEMINI_API_KEY)');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export function buildAiGenerateConfig(options: {
  model: string;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevel;
}): Record<string, any> {
  const normalizedModel = options.model.toLowerCase();
  const config: Record<string, any> = {};

  if (options.systemInstruction !== undefined) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.responseMimeType !== undefined) {
    config.responseMimeType = options.responseMimeType;
  }
  if (options.maxOutputTokens !== undefined) {
    config.maxOutputTokens = options.maxOutputTokens;
  }

  if (!NO_SAMPLING_PARAM_MODELS.has(normalizedModel)) {
    config.temperature = options.temperature ?? 0;
  }

  if (NO_SAMPLING_PARAM_MODELS.has(normalizedModel)) {
    config.thinkingConfig = {
      thinkingLevel: options.thinkingLevel ?? ThinkingLevel.LOW
    };
  } else if (normalizedModel === 'gemini-3.1-flash-lite') {
    config.thinkingConfig = {
      thinkingLevel: options.thinkingLevel ?? ThinkingLevel.MINIMAL
    };
  }

  return config;
}

export interface SharedAiGenerateResult {
  text: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  rawResponse: any;
}

export function extractTokenCounts(response: any): {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const usage = response?.usageMetadata;
  const promptTokens = typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : 0;
  const outputTokens =
    typeof usage?.candidatesTokenCount === 'number'
      ? usage.candidatesTokenCount
      : typeof usage?.responseTokenCount === 'number'
      ? usage.responseTokenCount
      : 0;
  const totalTokens =
    typeof usage?.totalTokenCount === 'number'
      ? usage.totalTokenCount
      : promptTokens + outputTokens;

  return { promptTokens, outputTokens, totalTokens };
}

/**
 * Shared helper to execute a Gemini generateContent call with timeout,
 * Vertex/API-key support, temperature 0, and token usage extraction.
 */
export async function generateSharedAiContent(params: {
  model?: string;
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevel;
  timeoutMs?: number;
  customApiKey?: string;
  callerLabel?: string;
}): Promise<SharedAiGenerateResult> {
  const model = getAiModel(params.model);
  const vertexMode = isVertexAiProvider();
  const label = params.callerLabel || 'AIClient';

  let timer: NodeJS.Timeout | undefined;
  try {
    const ai = getSharedAiClient(params.customApiKey);
    const config = buildAiGenerateConfig({
      model,
      systemInstruction: params.systemInstruction,
      responseMimeType: params.responseMimeType,
      temperature: params.temperature ?? 0,
      maxOutputTokens: params.maxOutputTokens,
      thinkingLevel: params.thinkingLevel
    });

    const callPromise = ai.models.generateContent({
      model,
      contents: params.contents,
      config
    });

    const response = params.timeoutMs
      ? await Promise.race([
          callPromise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`AI call timed out after ${params.timeoutMs}ms`)),
              params.timeoutMs
            );
          })
        ])
      : await callPromise;

    const text = response?.text;
    if (!text) {
      throw new Error('Empty response from AI model');
    }

    const { promptTokens, outputTokens, totalTokens } = extractTokenCounts(response);
    return {
      text,
      model,
      promptTokens,
      outputTokens,
      totalTokens,
      rawResponse: response
    };
  } catch (err: any) {
    if (vertexMode) {
      console.error(
        `[${label}:VertexError] Vertex AI call failed (project=${process.env.GOOGLE_CLOUD_PROJECT || 'unset'}, location=${process.env.GOOGLE_CLOUD_LOCATION || 'global'}, model=${model}):`,
        err?.message || err
      );
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
