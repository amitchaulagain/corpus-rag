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

  async syncUserFiles(userId: string, waitForCompletion: boolean = true): Promise<{
    success: boolean;
    synced: number;
    removed: number;
    failed: number;
    pendingOperations?: string[];
    error?: string;
  }> {
    try {
      console.log(`🔄 Starting sync for user: ${userId}`);

      // Get user's corpus
      const corpusResult = await this.corpus.getUserCorpus(userId);
      if (!corpusResult.success || !corpusResult.corpusId) {
        throw new Error('Failed to get user corpus');
      }

      console.log(`✅ Using corpus: ${corpusResult.corpusId}`);

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

      console.log(`📁 Cloud files: ${cloudFiles.length}, RAG files: ${ragFiles.length}`);

      // Create maps using GCS URIs for precise matching
      const cloudFileMap = new Map(cloudFiles.map(f => [f.fileId, f])); // fileId is gs:// URI
      const ragFileMap = new Map();

      // Build RAG file map using GCS source URIs
      ragFiles.forEach(f => {
        if (f.gcsSource?.uris) {
          f.gcsSource.uris.forEach((uri: string) => {
            ragFileMap.set(uri, f);
          });
        }
      });

      let syncedCount = 0;
      let removedCount = 0;
      let failedCount = 0;
      const pendingOperations: string[] = [];

      // Find files to add (in cloud but not in RAG or failed in RAG)
      const filesToAdd: string[] = [];
      for (const [gcsUri, cloudFile] of cloudFileMap) {
        const ragFile = ragFileMap.get(gcsUri);

        if (!ragFile) {
          console.log(`📝 File needs import: ${cloudFile.name} (${gcsUri})`);
          filesToAdd.push(gcsUri);
        } else if (ragFile.state === 'FAILED') {
          console.log(`🔄 Re-importing failed file: ${cloudFile.name} (${gcsUri})`);
          // Remove failed file first
          try {
            await this.rag.deleteRagFile(ragFile.ragFileId || ragFile.name);
          } catch (error) {
            console.warn(`Failed to remove failed file ${cloudFile.name}:`, error);
          }
          filesToAdd.push(gcsUri);
        } else if (ragFile.state === 'ACTIVE') {
          console.log(`✅ File already synced: ${cloudFile.name}`);
        } else {
          console.log(`⏳ File in progress: ${cloudFile.name} (state: ${ragFile.state})`);
        }
      }

      // Import missing files
      if (filesToAdd.length > 0) {
        console.log(`🔄 Importing ${filesToAdd.length} files...`);

        const importResult = await this.rag.importFiles({
          userId,
          cloudStorageUris: filesToAdd
        });

        if (importResult.success && importResult.operationId) {
          console.log(`🚀 Import operation started: ${importResult.operationId}`);

          if (waitForCompletion) {
            console.log(`⏳ Waiting for import to complete...`);
            const waitResult = await this.rag.waitForOperation(importResult.operationId, 180000); // 3 minutes

            if (waitResult.success && waitResult.completed) {
              console.log(`✅ Import completed successfully`);
              syncedCount = filesToAdd.length;
            } else {
              console.warn(`⚠️ Import operation did not complete: ${waitResult.error}`);
              failedCount = filesToAdd.length;
              if (!waitResult.completed) {
                pendingOperations.push(importResult.operationId);
              }
            }
          } else {
            pendingOperations.push(importResult.operationId);
            syncedCount = filesToAdd.length; // Optimistic count
          }
        } else {
          console.error(`❌ Import failed: ${importResult.error}`);
          failedCount = filesToAdd.length;
        }
      }

      // Find files to remove (in RAG but not in cloud)
      const filesToRemove: any[] = [];
      for (const [gcsUri, ragFile] of ragFileMap) {
        if (!cloudFileMap.has(gcsUri)) {
          filesToRemove.push(ragFile);
        }
      }

      // Remove orphaned files
      for (const ragFile of filesToRemove) {
        const fileName = ragFile.name?.split('/').pop() || 'Unknown';
        console.log(`🗑️ Removing orphaned file: ${fileName}`);

        try {
          const deleteResult = await this.rag.deleteRagFile(ragFile.ragFileId || ragFile.name);
          if (deleteResult.success) {
            removedCount++;
          } else {
            console.warn(`Failed to remove ${fileName}:`, deleteResult.error);
          }
        } catch (error) {
          console.warn(`Failed to remove ${fileName}:`, error);
        }
      }

      console.log(`✅ Sync completed: ${syncedCount} synced, ${removedCount} removed, ${failedCount} failed`);

      return {
        success: true,
        synced: syncedCount,
        removed: removedCount,
        failed: failedCount,
        pendingOperations: pendingOperations.length > 0 ? pendingOperations : undefined
      };

    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        synced: 0,
        removed: 0,
        failed: 0,
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
      console.log(`🔄 Updating file: ${fileName} for user: ${userId}`);

      // Get user's corpus first
      const corpusResult = await this.corpus.getUserCorpus(userId);
      if (!corpusResult.success || !corpusResult.corpusId) {
        throw new Error('Failed to get user corpus');
      }

      // Build the expected GCS URI for this file
      const gcsUri = `gs://${this.storage.getBucketName()}/users/${userId}/${fileName}`;

      // Check if file exists in RAG corpus and remove it first
      const existingFiles = await this.rag.getFilesByGcsUri(corpusResult.corpusId, [gcsUri]);
      if (existingFiles.success && existingFiles.files && existingFiles.files.length > 0) {
        console.log(`🗑️ Removing existing RAG file for update: ${fileName}`);
        for (const existingFile of existingFiles.files) {
          try {
            await this.rag.deleteRagFile(existingFile.ragFileId || existingFile.name);
            console.log(`✅ Removed old version of ${fileName}`);
          } catch (error) {
            console.warn(`Failed to remove old version of ${fileName}:`, error);
          }
        }
      }

      // Update file in cloud storage
      const updateResult = await this.storage.updateFileContent(userId, fileName, content);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Update failed');
      }

      console.log(`✅ File updated in cloud storage: ${fileName}`);

      // Wait a moment for storage consistency
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Re-import the updated file to RAG corpus
      console.log(`🔄 Re-importing updated file to RAG: ${fileName}`);
      const importResult = await this.rag.importFiles({
        userId,
        cloudStorageUris: [gcsUri]
      });

      let syncResult = null;
      if (importResult.success && importResult.operationId) {
        console.log(`🚀 Import operation started: ${importResult.operationId}`);

        // Wait for the import to complete
        const waitResult = await this.rag.waitForOperation(importResult.operationId, 180000);
        if (waitResult.success && waitResult.completed) {
          console.log(`✅ File update and re-import completed successfully`);
          syncResult = {
            success: true,
            synced: 1,
            removed: 0,
            failed: 0,
            operationId: importResult.operationId
          };
        } else {
          console.warn(`⚠️ Import operation did not complete: ${waitResult.error}`);
          syncResult = {
            success: false,
            synced: 0,
            removed: 0,
            failed: 1,
            error: waitResult.error,
            operationId: importResult.operationId
          };
        }
      } else {
        console.error(`❌ Re-import failed: ${importResult.error}`);
        syncResult = {
          success: false,
          synced: 0,
          removed: 0,
          failed: 1,
          error: importResult.error
        };
      }

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