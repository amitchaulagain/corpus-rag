import type { Cost } from './providers/base-provider';

// Pricing per 1M tokens (as of 2025)
export const PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.00,   // $3 per 1M input tokens
    output: 15.00  // $15 per 1M output tokens
  },
  'deepseek-chat': {
    input: 0.28,   // $0.28 per 1M input tokens (cache miss)
    inputCacheHit: 0.028,  // $0.028 per 1M input tokens (cache hit) - 10x cheaper
    output: 0.42   // $0.42 per 1M output tokens (DeepSeek-V3.2-Exp)
  },
  'gemini-2.0-flash-exp': {
    input: 0.00,   // FREE tier (up to 1500 RPM)
    output: 0.00   // FREE tier
  }
};

// Note: These are not live rates and are for demonstration purposes.
// Rates as of Oct 2025.
export const EXCHANGE_RATES = {
  USD_TO_AUD: 1.52,
  USD_TO_NPR: 142.0,
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheHitRatio: number = 0 // 0-1, portion of input tokens that hit cache
): Cost | undefined {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return undefined;

  let inputCost = 0;

  // DeepSeek has separate pricing for cache hits
  if ('inputCacheHit' in pricing && cacheHitRatio > 0) {
    const cacheHitTokens = Math.floor(inputTokens * cacheHitRatio);
    const cacheMissTokens = inputTokens - cacheHitTokens;

    inputCost =
      (cacheMissTokens / 1_000_000) * pricing.input +
      (cacheHitTokens / 1_000_000) * pricing.inputCacheHit;
  } else {
    inputCost = (inputTokens / 1_000_000) * pricing.input;
  }

  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const usdCost = inputCost + outputCost;

  if (usdCost === 0) {
    return { usd: 0, aud: 0, npr: 0 };
  }

  return {
    usd: usdCost,
    aud: usdCost * EXCHANGE_RATES.USD_TO_AUD,
    npr: usdCost * EXCHANGE_RATES.USD_TO_NPR,
  };
}
