import { BaseAIProvider, type QueryRequest, type QueryResponse } from './base-provider';

export class ClaudeProvider extends BaseAIProvider {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature || 0.7,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ]
        })
      });

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Claude API error (${response.status}): ${error}`,
          metadata: { model: this.config.model, processingTime }
        };
      }

      const data = await response.json();

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;

      // Import pricing calculation
      const { calculateCost } = await import('../pricing');
      const cost = calculateCost(this.config.model, inputTokens, outputTokens);

      return {
        success: true,
        answer: data.content[0].text,
        metadata: {
          model: this.config.model,
          tokensUsed: inputTokens + outputTokens,
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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
