// storage-client.ts - Google Cloud Storage client for your Svelte app
import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

interface StorageConfig {
  projectId: string;
  bucketName: string;
  keyFilename?: string; // Optional service account key file path
}

export class RAGStorageClient {
  private storage: Storage;
  private bucketName: string;
  private bucket: any;

  constructor(config: StorageConfig) {
    this.storage = new Storage({
      projectId: config.projectId,
      keyFilename: config.keyFilename // Optional - will use ADC if not provided
    });

    this.bucketName = config.bucketName;
    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Create user-specific folder structure
   */
  async createUserFolder(userId: string): Promise<{ success: boolean; folderPath?: string; error?: string }> {
    try {
      const folderPath = `users/${userId}/`;

      // Create a placeholder file to ensure folder exists
      const file = this.bucket.file(`${folderPath}.keep`);
      await file.save('', { resumable: false });

      return { success: true, folderPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Upload file to user's folder
   */
  async uploadFile(
    userId: string,
    file: File,
    customFileName?: string
  ): Promise<{ success: boolean; filePath?: string; fileId?: string; error?: string }> {
    try {
      const fileName = customFileName || file.name;
      const filePath = `users/${userId}/${fileName}`;
      const storageFile = this.bucket.file(filePath);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await storageFile.save(buffer, {
        metadata: {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
            userId: userId,
            size: file.size.toString()
          }
        },
        resumable: false
      });

      // Generate signed URL for access
      const [url] = await storageFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year
      });

      return {
        success: true,
        filePath,
        fileId: `gs://${this.bucketName}/${filePath}`
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * List user's files
   */
  async listUserFiles(userId: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      const [files] = await this.bucket.getFiles({
        prefix: `users/${userId}/`,
        delimiter: '/'
      });

      const fileList = files
        .filter(file => !file.name.endsWith('.keep'))
        .map(file => ({
          name: file.name.split('/').pop(),
          fullPath: file.name,
          size: file.metadata.size,
          contentType: file.metadata.contentType,
          created: file.metadata.timeCreated,
          updated: file.metadata.updated,
          fileId: `gs://${this.bucketName}/${file.name}`
        }));

      return { success: true, files: fileList };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete file
   */
  async deleteFile(userId: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = `users/${userId}/${fileName}`;
      await this.bucket.file(filePath).delete();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get signed URL for file access
   */
  async getFileUrl(userId: string, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const filePath = `users/${userId}/${fileName}`;
      const file = this.bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 // 1 hour
      });

      return { success: true, url };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}