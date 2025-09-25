// Cloud Storage to Vertex RAG Sync Service
import { VertexRAGClient } from './rag-client';
import { RAGStorageClient } from './storage-client';
import { VertexCorpusManager } from './corpus-manager';

interface SyncOptions {
  projectId: string;
  bucketName: string;
  location: string;
  apiKey: string;
}

export class CloudVertexSyncService {
  private rag: VertexRAGClient;
  private storage: RAGStorageClient;
  private corpus: VertexCorpusManager;

  constructor(options: SyncOptions) {
    this.rag = new VertexRAGClient({
      projectId: options.projectId,
      location: options.location,
      apiKey: options.apiKey
    });

    this.storage = new RAGStorageClient({
      projectId: options.projectId,
      bucketName: options.bucketName
    });

    this.corpus = new VertexCorpusManager({
      projectId: options.projectId,
      location: options.location
    });
  }

  async syncUserFiles(userId: string): Promise<{
    success: boolean;
    synced: number;
    removed: number;
    error?: string;
  }> {
    try {
      // Get user's corpus
      const corpusResult = await this.corpus.getUserCorpus(userId);
      if (!corpusResult.success || !corpusResult.corpusId) {
        throw new Error('Failed to get user corpus');
      }

      // Get cloud storage files
      const cloudResult = await this.storage.listUserFiles(userId);
      if (!cloudResult.success) {
        throw new Error('Failed to list cloud files');
      }

      // Get RAG corpus files
      const ragResult = await this.rag.listCorpusFiles(corpusResult.corpusId);
      if (!ragResult.success) {
        throw new Error('Failed to list RAG files');
      }

      const cloudFiles = cloudResult.files || [];
      const ragFiles = ragResult.files || [];

      // Create maps for easier comparison
      const cloudFileMap = new Map(cloudFiles.map(f => [f.name, f.fileId]));
      const ragFileMap = new Map(ragFiles.map(f => [f.displayName || f.name?.split('/').pop(), f.name]));

      let syncedCount = 0;
      let removedCount = 0;

      // Add missing files to RAG corpus
      for (const [fileName, fileId] of cloudFileMap) {
        if (!ragFileMap.has(fileName)) {
          console.log(`🔄 Syncing file to RAG: ${fileName}`);
          try {
            const importResult = await this.rag.importFiles({
              userId,
              cloudStorageUris: [fileId]
            });
            if (importResult.success) {
              syncedCount++;
            }
          } catch (error) {
            console.warn(`Failed to sync ${fileName}:`, error);
          }
        }
      }

      // Remove files from RAG corpus that no longer exist in cloud storage
      for (const [fileName, ragFileId] of ragFileMap) {
        if (!cloudFileMap.has(fileName)) {
          console.log(`🗑️ Removing file from RAG: ${fileName}`);
          try {
            const deleteResult = await this.rag.deleteRagFile(ragFileId);
            if (deleteResult.success) {
              removedCount++;
            }
          } catch (error) {
            console.warn(`Failed to remove ${fileName} from RAG:`, error);
          }
        }
      }

      return {
        success: true,
        synced: syncedCount,
        removed: removedCount
      };

    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        synced: 0,
        removed: 0,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  async uploadAndSync(userId: string, file: File, fileName: string): Promise<{
    success: boolean;
    file?: any;
    syncResult?: any;
    error?: string;
  }> {
    try {
      // Upload to cloud storage
      const uploadResult = await this.storage.uploadFile(userId, file, fileName);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Auto-sync to RAG corpus
      const syncResult = await this.syncUserFiles(userId);

      return {
        success: true,
        file: {
          id: uploadResult.fileId,
          name: fileName,
          size: file.size,
          mimeType: file.type,
          userId,
          fileId: uploadResult.fileId,
          fullPath: uploadResult.filePath,
          created: new Date().toISOString()
        },
        syncResult
      };

    } catch (error) {
      console.error('Upload and sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteAndSync(userId: string, fileName: string): Promise<{
    success: boolean;
    syncResult?: any;
    error?: string;
  }> {
    try {
      // Delete from cloud storage
      const deleteResult = await this.storage.deleteFile(userId, fileName);
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Delete failed');
      }

      // Auto-sync RAG corpus (will remove the file)
      const syncResult = await this.syncUserFiles(userId);

      return {
        success: true,
        syncResult
      };

    } catch (error) {
      console.error('Delete and sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateAndSync(userId: string, fileName: string, content: string): Promise<{
    success: boolean;
    syncResult?: any;
    error?: string;
  }> {
    try {
      // Update file in cloud storage
      const updateResult = await this.storage.updateFileContent(userId, fileName, content);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Update failed');
      }

      // Re-sync to RAG corpus (this will update the indexed content)
      const syncResult = await this.syncUserFiles(userId);

      return {
        success: true,
        syncResult
      };

    } catch (error) {
      console.error('Update and sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}