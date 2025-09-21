// rag-client.ts - Vertex AI RAG client for TypeScript
import { GoogleAuth } from 'google-auth-library';

interface RAGConfig {
  projectId: string;
  location: string;
  ragCorpusId: string;
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

  constructor(config: RAGConfig) {
    this.config = config;
    this.auth = new GoogleAuth({
      keyFilename: config.keyFilename,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
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
   * Import files from Cloud Storage into RAG corpus
   */
  async importFiles(request: ImportRequest): Promise<ImportResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${this.config.ragCorpusId}:importRagFiles`;

      const body = {
        importRagFilesConfig: {
          gcsSource: {
            uris: request.cloudStorageUris
          },
          ragFileChunkingConfig: {
            chunkSize: 1024,
            chunkOverlap: 200
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Import failed: ${response.status} - ${error}` };
      }

      const result = await response.json();
      return {
        success: true,
        operationId: result.name // Long-running operation ID
      };

    } catch (error) {
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
                ragCorpus: `projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${this.config.ragCorpusId}`
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