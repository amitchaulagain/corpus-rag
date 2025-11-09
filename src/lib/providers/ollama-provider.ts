import { BaseAIProvider, type QueryRequest, type QueryResponse } from './base-provider';

export class OllamaProvider extends BaseAIProvider {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    // Ollama runs locally on port 11434 by default
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async query(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      // Use streaming to get faster responses from Ollama
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: request.prompt,
          stream: true, // Enable streaming for faster token delivery
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 4096
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Ollama API error (${response.status}): ${error}`,
          metadata: { model: this.config.model, processingTime: Date.now() - startTime }
        };
      }

      // Read streaming response and accumulate tokens
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            // Accumulate response tokens
            if (data.response) {
              fullResponse += data.response;
            }

            // Get final token counts when done
            if (data.done) {
              inputTokens = data.prompt_eval_count || 0;
              outputTokens = data.eval_count || 0;
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        answer: fullResponse,
        metadata: {
          model: this.config.model,
          tokensUsed: inputTokens + outputTokens,
          inputTokens,
          outputTokens,
          processingTime,
          cost: {
            usd: 0, // Ollama is free (local)
            aud: 0,
            npr: 0
          }
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a connection error (Ollama not running)
      const isConnectionError = errorMessage.includes('fetch failed') ||
                                errorMessage.includes('ECONNREFUSED') ||
                                errorMessage.includes('Failed to fetch');

      return {
        success: false,
        error: isConnectionError
          ? `Ollama server is not running. Please start Ollama:\n\n1. Run: ollama serve\n2. Or check http://localhost:11434`
          : errorMessage,
        metadata: {
          model: this.config.model,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // First check if Ollama is running
      const tagsResponse = await fetch(`${this.baseUrl}/api/tags`);
      if (!tagsResponse.ok) return false;

      // Then test if the specific model is available
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: 'test',
          stream: false,
          options: {
            num_predict: 10
          }
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
