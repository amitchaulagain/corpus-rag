import { BaseAIProvider, type QueryRequest, type QueryResponse } from './base-provider';

export class GeminiProvider extends BaseAIProvider {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: request.prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: request.temperature || 0.7,
            maxOutputTokens: request.maxTokens || 8192
          }
        })
      });

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Gemini API error (${response.status}): ${error}`,
          metadata: { model: this.config.model, processingTime }
        };
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        return {
          success: false,
          error: 'No response from Gemini',
          metadata: { model: this.config.model, processingTime }
        };
      }

      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

      const { calculateCost } = await import('../pricing');
      const cost = calculateCost(this.config.model, inputTokens, outputTokens);

      return {
        success: true,
        answer: data.candidates[0].content.parts[0].text,
        metadata: {
          model: this.config.model,
          tokensUsed: data.usageMetadata?.totalTokenCount,
          inputTokens,
          outputTokens,
          processingTime,
          cost
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
