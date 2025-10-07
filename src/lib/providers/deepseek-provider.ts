import { BaseAIProvider, type QueryRequest, type QueryResponse } from './base-provider';

export class DeepSeekProvider extends BaseAIProvider {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ],
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature || 0.7
        })
      });

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `DeepSeek API error (${response.status}): ${error}`,
          metadata: { model: this.config.model, processingTime }
        };
      }

      const data = await response.json();

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;

      const { calculateCost } = await import('../pricing');
      const cost = calculateCost(this.config.model, inputTokens, outputTokens);

      return {
        success: true,
        answer: data.choices[0].message.content,
        metadata: {
          model: this.config.model,
          tokensUsed: data.usage?.total_tokens,
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
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
