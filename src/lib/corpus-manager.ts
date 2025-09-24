// corpus-manager.ts - Vertex AI Corpus Management for per-user isolation
import { GoogleAuth } from 'google-auth-library';

interface CorpusConfig {
  projectId: string;
  location: string;
  keyFilename?: string;
}

interface CreateCorpusRequest {
  userId: string;
  displayName?: string;
  description?: string;
}

interface CreateCorpusResponse {
  success: boolean;
  corpusId?: string;
  error?: string;
}

interface ListCorporaResponse {
  success: boolean;
  corpora?: Array<{
    name: string;
    corpusId: string;
    displayName: string;
    createTime: string;
  }>;
  error?: string;
}

interface GetUserCorpusResponse {
  success: boolean;
  corpusId?: string;
  exists?: boolean;
  error?: string;
}

export class VertexCorpusManager {
  private auth: GoogleAuth;
  private config: CorpusConfig;
  private creationPromises: Map<string, Promise<CreateCorpusResponse>> = new Map();

  constructor(config: CorpusConfig) {
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
   * Create a new corpus for a user
   */
  async createUserCorpus(request: CreateCorpusRequest): Promise<CreateCorpusResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora`;

      const displayName = request.displayName || `JobBot_User_${request.userId}_Corpus`;
      const description = request.description || `RAG corpus for user ${request.userId} - job hunting bot`;

      const body = {
        displayName,
        description
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Corpus creation failed: ${response.status} - ${error}` };
      }

      const result = await response.json();

      // Extract corpus ID from the full resource name
      // Format: projects/{project}/locations/{location}/ragCorpora/{corpusId}
      const corpusId = result.name.split('/').pop();

      return {
        success: true,
        corpusId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all corpora in the project
   */
  async listCorpora(): Promise<ListCorporaResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `List corpora failed: ${response.status} - ${error}` };
      }

      const result = await response.json();

      const corpora = (result.ragCorpora || []).map((corpus: any) => ({
        name: corpus.name,
        corpusId: corpus.name.split('/').pop(),
        displayName: corpus.displayName,
        createTime: corpus.createTime
      }));

      return {
        success: true,
        corpora
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get or create a corpus for a specific user (with deduplication)
   */
  async getUserCorpus(userId: string): Promise<GetUserCorpusResponse> {
    try {
      // Check if we're already creating a corpus for this user
      const existingPromise = this.creationPromises.get(userId);
      if (existingPromise) {
        console.log(`⏳ Waiting for existing corpus creation for user: ${userId}`);
        return await existingPromise;
      }

      // Create a promise for this user's corpus creation
      const corpusPromise = this.createUserCorpusInternal(userId);
      this.creationPromises.set(userId, corpusPromise);

      try {
        const result = await corpusPromise;
        return result;
      } finally {
        // Clean up the promise after completion
        this.creationPromises.delete(userId);
      }

    } catch (error) {
      this.creationPromises.delete(userId);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Internal method to handle corpus creation logic
   */
  private async createUserCorpusInternal(userId: string): Promise<GetUserCorpusResponse> {
    // First, list all corpora and check if user already has one
    const listResult = await this.listCorpora();

    if (!listResult.success) {
      return { success: false, error: listResult.error };
    }

    // Look for existing corpus with this user's display name pattern
    const userCorpus = listResult.corpora?.find(corpus =>
      corpus.displayName === `JobBot_User_${userId}_Corpus` ||
      corpus.displayName.includes(`User ${userId} Corpus`) ||
      corpus.displayName.includes(userId)
    );

    if (userCorpus) {
      console.log(`✅ Found existing corpus for user ${userId}: ${userCorpus.corpusId}`);
      return {
        success: true,
        corpusId: userCorpus.corpusId,
        exists: true
      };
    }

    // If no corpus exists, create one
    console.log(`🔨 Creating new corpus for user: ${userId}`);
    const createResult = await this.createUserCorpus({ userId });

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    console.log(`✅ Created new corpus for user ${userId}: ${createResult.corpusId}`);
    return {
      success: true,
      corpusId: createResult.corpusId,
      exists: false
    };
  }

  /**
   * Delete a corpus (use with caution!)
   */
  async deleteCorpus(corpusId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Delete corpus failed: ${response.status} - ${error}` };
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
   * Get corpus details
   */
  async getCorpusDetails(corpusId: string): Promise<{
    success: boolean;
    corpus?: any;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1beta1/projects/${this.config.projectId}/locations/${this.config.location}/ragCorpora/${corpusId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get corpus failed: ${response.status} - ${error}` };
      }

      const corpus = await response.json();
      return { success: true, corpus };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clean up duplicate corpora for a user (keeps the newer one)
   */
  async cleanupDuplicateCorpora(userId: string): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      const listResult = await this.listCorpora();
      if (!listResult.success) {
        return { success: false, error: listResult.error };
      }

      // Find all corpora for this user
      const userCorpora = listResult.corpora?.filter(corpus =>
        corpus.displayName === `JobBot_User_${userId}_Corpus` ||
        corpus.displayName.includes(`User ${userId} Corpus`) ||
        corpus.displayName.includes(userId)
      ) || [];

      if (userCorpora.length <= 1) {
        return { success: true, deletedCount: 0 };
      }

      // Sort by creation time (newest first)
      userCorpora.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());

      // Keep the newest one, delete the rest
      const toDelete = userCorpora.slice(1);
      let deletedCount = 0;

      for (const corpus of toDelete) {
        const deleteResult = await this.deleteCorpus(corpus.corpusId);
        if (deleteResult.success) {
          deletedCount++;
          console.log(`🗑️ Deleted duplicate corpus: ${corpus.corpusId}`);
        } else {
          console.warn(`⚠️ Failed to delete corpus ${corpus.corpusId}: ${deleteResult.error}`);
        }
      }

      return { success: true, deletedCount };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}