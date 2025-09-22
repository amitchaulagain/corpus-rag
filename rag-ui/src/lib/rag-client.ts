// rag-client.ts - Vertex AI RAG client for TypeScript
import { GoogleAuth } from 'google-auth-library';
import { VertexCorpusManager } from './corpus-manager.js';

interface RAGConfig {
  projectId: string;
  location: string;
  ragCorpusId?: string; // Now optional - will be resolved per user
  keyFilename?: string;
}

interface QueryRequest {
  userId: string;
  question: string;
  maxTokens?: number;
  temperature?: number;
}

interface QueryResponse {
  success: boolean;
  answer?: string;
  error?: string;
}

interface ImportRequest {
  userId: string;
  cloudStorageUris: string[]; // gs:// URIs from Cloud Storage
}

interface ImportResponse {
  success: boolean;
  operationId?: string;
  error?: string;
}

export class VertexRAGClient {
  private auth: GoogleAuth;
  private config: RAGConfig;
  private corpusManager: VertexCorpusManager;

  constructor(config: RAGConfig) {
    this.config = config;
    this.auth = new GoogleAuth({
      keyFilename: config.keyFilename,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    this.corpusManager = new VertexCorpusManager({
      projectId: config.projectId,
      location: config.location,
      keyFilename: config.keyFilename
    });
  }

  /**
   * Get authenticated headers for API calls
   */
  private async getAuthHeaders(): Promise<{ [key: string]: string }> {
    const authClient = await this.auth.getClient();
    const accessToken = await authClient.getAccessToken();

    return {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get or create corpus for a user
   */
  private async resolveUserCorpus(userId: string): Promise<{ success: boolean; corpusId?: string; error?: string }> {
    // If a default corpus is configured, use it (backward compatibility)
    if (this.config.ragCorpusId) {
      return { success: true, corpusId: this.config.ragCorpusId };
    }

    // Otherwise, get or create user-specific corpus
    const result = await this.corpusManager.getUserCorpus(userId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, corpusId: result.corpusId };
  }

  /**
   * Import files from Cloud Storage into RAG corpus
   */
  async importFiles(request: ImportRequest): Promise<ImportResponse> {
    try {
      console.log(`🔄 Starting import for user: ${request.userId}`);
      console.log(`📁 Files to import: ${request.cloudStorageUris.join(', ')}`);

      // Resolve user's corpus
      let corpusResult = await this.resolveUserCorpus(request.userId);
      if (!corpusResult.success) {
        console.error(`❌ Failed to resolve corpus: ${corpusResult.error}`);
        return { success: false, error: corpusResult.error };
      }

      console.log(`✅ Using corpus ID: ${corpusResult.corpusId}`);

      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.clients6.google.com/ui/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusResult.corpusId}/ragFiles:import?key=AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g`;

      console.log(`🌐 Import URL: ${url}`);

      const body = {
        importRagFilesConfig: {
          gcsSource: {
            uris: request.cloudStorageUris
          },
          ragFileTransformationConfig: {
            ragFileChunkingConfig: {
              fixedLengthChunking: {
                chunkSize: 1024,
                chunkOverlap: 256
              }
            }
          },
          maxEmbeddingRequestsPerMin: 1000
        }
      };

      console.log(`📦 Request body:`, JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Import failed with status ${response.status}:`, error);

        // If corpus not found, try to create/refresh and retry once
        if (response.status === 404) {
          console.log(`🔄 Corpus ${corpusResult.corpusId} not found, refreshing corpus for user ${request.userId}`);

          // Force refresh the corpus (get a new one)
          corpusResult = await this.corpusManager.getUserCorpus(request.userId);
          if (!corpusResult.success) {
            console.error(`❌ Corpus refresh failed: ${corpusResult.error}`);
            return { success: false, error: `Corpus refresh failed: ${corpusResult.error}` };
          }

          console.log(`🔄 Retrying with new corpus ID: ${corpusResult.corpusId}`);

          // Retry with new corpus ID
          const retryUrl = `https://${this.config.location}-aiplatform.clients6.google.com/ui/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusResult.corpusId}/ragFiles:import?key=AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g`;

          console.log(`🌐 Retry URL: ${retryUrl}`);

          const retryResponse = await fetch(retryUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          console.log(`📊 Retry response status: ${retryResponse.status} ${retryResponse.statusText}`);

          if (!retryResponse.ok) {
            const retryError = await retryResponse.text();
            console.error(`❌ Import retry failed:`, retryError);
            return { success: false, error: `Import retry failed: ${retryResponse.status} - ${retryError}` };
          }

          const retryResult = await retryResponse.json();
          console.log(`✅ Import retry successful:`, retryResult);
          return {
            success: true,
            operationId: retryResult.name
          };
        }

        return { success: false, error: `Import failed: ${response.status} - ${error}` };
      }

      const result = await response.json();
      console.log(`✅ Import successful:`, result);
      return {
        success: true,
        operationId: result.name // Long-running operation ID
      };

    } catch (error) {
      console.error(`❌ Import exception:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Query the RAG system using Gemini
   */
  async query(request: QueryRequest): Promise<QueryResponse> {
    try {
      // Resolve user's corpus
      const corpusResult = await this.resolveUserCorpus(request.userId);
      if (!corpusResult.success) {
        return { success: false, error: corpusResult.error };
      }

      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/gemini-2.5-flash-lite:generateContent`;

      const body = {
        contents: [{
          role: "user",
          parts: [{
            text: request.question
          }]
        }],
        tools: [{
          retrieval: {
            vertexRagStore: {
              ragResources: [{
                ragCorpus: `projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusResult.corpusId}`
              }],
              ragRetrievalConfig: {
                topK: 8,
                // Add user-specific filtering if needed
                // filter: {
                //   metadataFilter: `user_id == "${request.userId}"`
                // }
              }
            }
          }
        }],
        generationConfig: {
          temperature: request.temperature || 0.4,
          topP: 0.95,
          maxOutputTokens: request.maxTokens || 2048,
          candidateCount: 1
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Query failed: ${response.status} - ${error}` };
      }

      const result = await response.json();

      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const answer = result.candidates[0].content.parts[0].text;
        return { success: true, answer };
      } else {
        return { success: false, error: 'No response generated' };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check the status of a long-running import operation
   */
  async checkImportStatus(operationId: string): Promise<{
    success: boolean;
    done?: boolean;
    error?: string;
    result?: any
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/${operationId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Status check failed: ${response.status} - ${error}` };
      }

      const result = await response.json();
      return {
        success: true,
        done: result.done || false,
        result: result.response || result.error
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}