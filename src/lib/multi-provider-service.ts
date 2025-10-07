import { LocalFileStorage } from './local-storage';
import { ProviderConfigManager } from './provider-config';
import { ClaudeProvider } from './providers/claude-provider';
import { DeepSeekProvider } from './providers/deepseek-provider';
import { GeminiProvider } from './providers/gemini-provider';
import type { BaseAIProvider } from './providers/base-provider';
import type { QueryResponse } from './providers/base-provider';

interface ComparisonResult {
  [providerId: string]: QueryResponse;
}

export class MultiProviderService {
  private storage: LocalFileStorage;
  private configManager: ProviderConfigManager;

  constructor() {
    this.storage = new LocalFileStorage('./data/uploads');
    this.configManager = new ProviderConfigManager();
  }

  async queryAll(userId: string, question: string): Promise<ComparisonResult> {
    // Get all user documents
    const documentsText = await this.getAllUserDocuments(userId);

    // Build prompt - work even without documents
    const prompt = documentsText && documentsText.trim().length > 0
      ? this.buildPrompt(documentsText, question)
      : `Answer this question directly: ${question}`;

    // Get enabled providers
    const configs = await this.configManager.getEnabledProviders();

    if (configs.length === 0) {
      return this.createErrorResult('No AI providers configured');
    }

    // Query all providers in parallel
    const results = await Promise.all(
      configs.map(async (config) => {
        const provider = this.createProvider(config);
        const response = await provider.query({ prompt });

        return {
          id: config.id,
          response
        };
      })
    );

    // Convert to map
    const resultMap: ComparisonResult = {};
    for (const { id, response } of results) {
      resultMap[id] = response;
    }

    return resultMap;
  }

  async querySingle(
    userId: string,
    question: string,
    providerId: string
  ): Promise<QueryResponse> {
    // Get all user documents
    const documentsText = await this.getAllUserDocuments(userId);

    // Build prompt - work even without documents
    const prompt = documentsText && documentsText.trim().length > 0
      ? this.buildPrompt(documentsText, question)
      : `Answer this question directly: ${question}`;

    // Get provider config
    const config = await this.configManager.getProvider(providerId);

    if (!config || !config.enabled) {
      return {
        success: false,
        error: `Provider not available: ${providerId}`,
        metadata: { model: 'unknown', processingTime: 0 }
      };
    }

    // Query provider
    const provider = this.createProvider(config);
    return await provider.query({ prompt });
  }

  private async getAllUserDocuments(userId: string): Promise<string> {
    try {
      const files = await this.storage.listFiles(userId);
      const contents = await Promise.all(
        files.map(filename => this.storage.getFileContent(userId, filename))
      );
      return contents.join('\n\n---\n\n');
    } catch (error) {
      return '';
    }
  }

  private buildPrompt(documentsText: string, question: string): string {
    return `You are a helpful AI assistant. Answer the question based on the following documents.

DOCUMENTS:
${documentsText}

QUESTION: ${question}

Please provide a clear and concise answer based on the information in the documents. If the documents don't contain enough information to answer the question, say so.`;
  }

  private createProvider(config: any): BaseAIProvider {
    switch (config.type) {
      case 'claude':
        return new ClaudeProvider(config);
      case 'deepseek':
        return new DeepSeekProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  private createErrorResult(error: string): ComparisonResult {
    return {
      error: {
        success: false,
        error,
        metadata: { model: 'unknown', processingTime: 0 }
      }
    };
  }

}
