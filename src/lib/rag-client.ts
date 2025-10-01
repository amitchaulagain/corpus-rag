// rag-client.ts - Vertex AI RAG client for TypeScript
import { GoogleAuth } from 'google-auth-library';
import { VertexCorpusManager } from './corpus-manager.js';

interface RAGConfig {
  projectId: string;
  location: string;
  ragCorpusId?: string; // Now optional - will be resolved per user
  keyFilename?: string;
  apiKey?: string; // For clients6 endpoints
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
      const url = `https://${this.config.location}-aiplatform.clients6.google.com/ui/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusResult.corpusId}/ragFiles:import?key=${this.config.apiKey}`;

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
          const retryUrl = `https://${this.config.location}-aiplatform.clients6.google.com/ui/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusResult.corpusId}/ragFiles:import?key=${this.config.apiKey}`;

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

  /**
   * List all corpora in the project (for health checks)
   */
  async listCorpora(): Promise<{
    success: boolean;
    corpora?: any[];
    error?: string;
  }> {
    return await this.corpusManager.listCorpora();
  }

  /**
   * Delete a RAG file from the corpus
   */
  async deleteRagFile(ragFileId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();

      // Try clients6 endpoint first
      const deleteUrl = `https://${this.config.location}-aiplatform.clients6.google.com/ui/${ragFileId}${this.config.apiKey ? `?key=${this.config.apiKey}` : ''}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers
      });

      // If clients6 fails, try googleapis endpoint
      if (!response.ok && response.status === 404) {
        const fallbackUrl = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/${ragFileId}`;

        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'DELETE',
          headers
        });

        if (fallbackResponse.ok) {
          return { success: true };
        }

        const fallbackError = await fallbackResponse.text();
        return { success: false, error: `Delete failed: ${fallbackResponse.status} - ${fallbackError}` };
      }

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Delete failed: ${response.status} - ${error}` };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List files in a specific corpus
   */
  async listCorpusFiles(corpusId: string): Promise<{
    success: boolean;
    files?: any[];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const listUrl = `https://${this.config.location}-aiplatform.clients6.google.com/ui/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusId}/ragFiles${this.config.apiKey ? `?key=${this.config.apiKey}` : ''}`;

      const response = await fetch(listUrl, {
        method: 'GET',
        headers
      });

      // If clients6 fails, try the old googleapis endpoint
      if (!response.ok && response.status === 404) {
        const fallbackUrl = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusId}/ragFiles`;

        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers
        });

        if (fallbackResponse.ok) {
          const result = await fallbackResponse.json();
          const files = (result.ragFiles || []).map((ragFile: any) => ({
            name: ragFile.displayName || ragFile.name?.split('/').pop() || 'Unknown',
            ragFileId: ragFile.name,
            gcsSource: ragFile.gcsSource,
            sizeBytes: ragFile.sizeBytes,
            createTime: ragFile.createTime,
            updateTime: ragFile.updateTime,
            ragFileType: ragFile.ragFileType,
            problemMessage: ragFile.problemMessage,
            state: ragFile.state
          }));

          return {
            success: true,
            files
          };
        }
      }

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Failed to list files: ${response.status} - ${error}` };
      }

      const result = await response.json();
      const files = (result.ragFiles || []).map((ragFile: any) => ({
        name: ragFile.displayName || ragFile.name?.split('/').pop() || 'Unknown',
        ragFileId: ragFile.name,
        gcsSource: ragFile.gcsSource,
        sizeBytes: ragFile.sizeBytes,
        createTime: ragFile.createTime,
        updateTime: ragFile.updateTime,
        ragFileType: ragFile.ragFileType,
        problemMessage: ragFile.problemMessage,
        state: ragFile.state
      }));

      return {
        success: true,
        files
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check the status of a long-running operation
   */
  async checkOperationStatus(operationId: string): Promise<{
    success: boolean;
    done?: boolean;
    error?: string;
    response?: any;
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
        return { success: false, error: `Failed to check operation: ${response.status} - ${error}` };
      }

      const result = await response.json();
      return {
        success: true,
        done: result.done || false,
        error: result.error ? JSON.stringify(result.error) : undefined,
        response: result.response
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Wait for an operation to complete with timeout
   */
  async waitForOperation(operationId: string, timeoutMs: number = 300000): Promise<{
    success: boolean;
    completed?: boolean;
    error?: string;
    response?: any;
  }> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkOperationStatus(operationId);

      if (!status.success) {
        return { success: false, error: status.error };
      }

      if (status.done) {
        if (status.error) {
          return { success: false, error: status.error };
        }
        return { success: true, completed: true, response: status.response };
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: 'Operation timed out' };
  }

  /**
   * Get files by their GCS source URIs (for better matching)
   */
  async getFilesByGcsUri(corpusId: string, gcsUris: string[]): Promise<{
    success: boolean;
    files?: any[];
    error?: string;
  }> {
    try {
      const listResult = await this.listCorpusFiles(corpusId);
      if (!listResult.success) {
        return { success: false, error: listResult.error };
      }

      const files = (listResult.files || []).filter(file => {
        if (!file.gcsSource?.uris) return false;
        return gcsUris.some(uri => file.gcsSource.uris.includes(uri));
      });

      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}