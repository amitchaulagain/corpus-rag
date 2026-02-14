import { LocalFileStorage } from './local-storage';
import { ProviderConfigManager } from './provider-config';
import { ClaudeProvider } from './providers/claude-provider';
import { DeepSeekProvider } from './providers/deepseek-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OllamaProvider } from './providers/ollama-provider';
import type { BaseAIProvider } from './providers/base-provider';
import type { QueryResponse } from './providers/base-provider';
import { getDB } from './db/mongodb';
import { GenericQuestionsModel } from './models/generic-questions';
import { UserModel } from './models/user';
import { ObjectId } from 'mongodb';

interface ComparisonResult {
  [providerId: string]: QueryResponse;
}

export interface QueryExecutionOptions {
  prebuiltPrompt?: string;
  contextBlocks?: string[];
  contextSnapshotId?: string;
  retrievalMetadata?: Record<string, unknown>;
  disableAutoDocuments?: boolean;
}

export class MultiProviderService {
  private storage: LocalFileStorage;
  private configManager: ProviderConfigManager;

  constructor() {
    this.storage = new LocalFileStorage('./data/uploads');
    this.configManager = new ProviderConfigManager();
  }

  async queryAll(userId: string, question: string, options: QueryExecutionOptions = {}): Promise<ComparisonResult> {
    const prompt = await this.buildEffectivePrompt(userId, question, options);

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
        const enrichedResponse = this.attachRetrievalMetadata(response, options);

        return {
          id: config.id,
          response: enrichedResponse
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

  async queryAllStreaming(
    userId: string,
    question: string,
    onResult: (providerId: string, result: QueryResponse) => void,
    options: QueryExecutionOptions = {}
  ): Promise<void> {
    const prompt = await this.buildEffectivePrompt(userId, question, options);

    // Get enabled providers
    const configs = await this.configManager.getEnabledProviders();

    if (configs.length === 0) {
      onResult('error', {
        success: false,
        error: 'No AI providers configured',
        metadata: { model: 'unknown', processingTime: 0 }
      });
      return;
    }

    // Query all providers and stream results as they complete
    await Promise.all(
      configs.map(async (config) => {
        try {
          // Add timeout wrapper for each provider query (10 minutes)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout after 10 minutes')), 600000);
          });

          const queryPromise = this.createProvider(config).query({ prompt });

          const response = await Promise.race([queryPromise, timeoutPromise]);
          onResult(config.id, this.attachRetrievalMetadata(response, options));
        } catch (error) {
          onResult(config.id, this.attachRetrievalMetadata({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: { model: config.model, processingTime: 0 }
          }, options));
        }
      })
    );
  }

  async querySingle(
    userId: string,
    question: string,
    providerId: string,
    resumeText?: string,
    options: QueryExecutionOptions = {}
  ): Promise<QueryResponse> {
    const prompt = await this.buildEffectivePrompt(userId, question, options, resumeText);

    // Get provider config
    const config = await this.configManager.getProvider(providerId);

    if (!config || !config.enabled) {
      return this.attachRetrievalMetadata({
        success: false,
        error: `Provider not available: ${providerId}`,
        metadata: { model: 'unknown', processingTime: 0 }
      }, options);
    }

    // Query provider
    const provider = this.createProvider(config);
    const response = await provider.query({ prompt });
    return this.attachRetrievalMetadata(response, options);
  }

  private async buildEffectivePrompt(
    userId: string,
    question: string,
    options: QueryExecutionOptions,
    resumeText?: string
  ): Promise<string> {
    if (options.prebuiltPrompt) {
      return options.prebuiltPrompt;
    }

    if (options.contextBlocks && options.contextBlocks.length > 0) {
      return this.buildPrompt(options.contextBlocks.join('\n\n---\n\n'), question);
    }

    let documentsText = '';
    if (resumeText) {
      documentsText = resumeText;
    } else if (!options.disableAutoDocuments && userId) {
      documentsText = await this.getAllUserDocuments(userId);
    }

    return documentsText && documentsText.trim().length > 0
      ? this.buildPrompt(documentsText, question)
      : `Answer this question directly: ${question}`;
  }

  private attachRetrievalMetadata(response: QueryResponse, options: QueryExecutionOptions): QueryResponse {
    if (!options.contextSnapshotId && !options.retrievalMetadata) return response;
    return {
      ...response,
      metadata: {
        ...(response.metadata ?? { model: 'unknown', processingTime: 0 }),
        retrieval: {
          contextSnapshotId: options.contextSnapshotId,
          ...(options.retrievalMetadata ?? {})
        }
      }
    };
  }

  private async getAllUserDocuments(userId: string): Promise<string> {
    try {
      const fileContents: string[] = [];
      
      // Get uploaded files
      const files = await this.storage.listFiles(userId);
      const contents = await Promise.all(
        files.map(filename => this.storage.getFileContent(userId, filename))
      );
      fileContents.push(...contents.filter(c => c.trim().length > 0));
      
      // Get generic questions
      const genericQuestionsText = await this.getGenericQuestionsText(userId);
      if (genericQuestionsText.trim().length > 0) {
        fileContents.push(genericQuestionsText);
      }
      
      return fileContents.join('\n\n---\n\n');
    } catch (error) {
      console.error('Error getting user documents:', error);
      return '';
    }
  }

  private async getGenericQuestionsText(userId: string): Promise<string> {
    try {
      const db = await getDB();
      const genericQuestionsModel = new GenericQuestionsModel(db);
      const userModel = new UserModel(db);
      
      // Get user ObjectId from email
      const user = await userModel.findByEmail(userId);
      if (!user || !user._id) {
        return '';
      }
      
      const questions = await genericQuestionsModel.getQuestionsByUserId(user._id);
      
      if (questions.length === 0) {
        return '';
      }
      
      // Format as knowledge base text
      const formattedQuestions = questions.map((q, index) => {
        const keywords = q.match_keywords.join(', ');
        const answers = q.answers.join(' OR ');
        return `Q${index + 1}: For questions matching keywords "${keywords}", use these answers: ${answers}`;
      }).join('\n\n');
      
      return `GENERIC QUESTIONS & ANSWERS KNOWLEDGE BASE:\n${formattedQuestions}`;
    } catch (error) {
      console.error('Failed to get generic questions:', error);
      return '';
    }
  }

  private buildPrompt(documentsText: string, question: string): string {
    return `You are a helpful AI assistant. Answer the question based on the following documents and knowledge base.

DOCUMENTS & KNOWLEDGE BASE:
${documentsText}

QUESTION: ${question}

Please provide a clear and concise answer based on the information in the documents and knowledge base.

IMPORTANT: When answering, consider the following sources:
- Generic Questions Knowledge Base: Pre-defined Q&A pairs that match keywords in the question
- Resume/Documents: User's uploaded documents containing their background and experience
- Job Description: Details about the position being applied for

If the documents don't contain enough information to answer the question, say so.`;
  }

  private createProvider(config: any): BaseAIProvider {
    switch (config.type) {
      case 'claude':
        return new ClaudeProvider(config);
      case 'deepseek':
        return new DeepSeekProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
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
