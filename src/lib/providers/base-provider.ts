// Base interface for AI providers
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'claude' | 'deepseek' | 'gemini' | 'ollama';
  apiKey?: string;
  model: string;
  enabled: boolean;
  baseUrl?: string; // For Ollama and other local providers
}

export interface QueryRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Cost {
  usd: number;
  aud: number;
  npr: number;
}

export interface QueryResponse {
  success: boolean;
  answer?: string;
  error?: string;
  metadata?: {
    model: string;
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
    processingTime: number;
    cost?: Cost;
  };
}

export abstract class BaseAIProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract query(request: QueryRequest): Promise<QueryResponse>;
  abstract testConnection(): Promise<boolean>;

  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      model: this.config.model
    };
  }
}
