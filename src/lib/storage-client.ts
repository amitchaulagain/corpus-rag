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
    // Use the project ID and try to authenticate with default credentials
    this.storage = new Storage({
      projectId: config.projectId,
      // Removed keyFilename to use Application Default Credentials
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
   * Get public URL for file access (no signing needed for public buckets)
   */
  async getFileUrl(userId: string, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const filePath = `users/${userId}/${fileName}`;
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      return { success: true, url: publicUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get file content as text (for preview)
   */
  async getFileContent(userId: string, fileName: string): Promise<{
    success: boolean;
    content?: string;
    contentType?: string;
    error?: string
  }> {
    try {
      const filePath = `users/${userId}/${fileName}`;
      const file = this.bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        return { success: false, error: 'File not found' };
      }

      // Get metadata to check content type
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'application/octet-stream';

      // Only read text files for preview
      const textTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/javascript',
        'application/typescript'
      ];

      const isTextFile = textTypes.some(type => contentType.startsWith(type));
      if (!isTextFile) {
        return { success: false, error: `Cannot preview file type: ${contentType}` };
      }

      // Download file content
      const [buffer] = await file.download();
      const content = buffer.toString('utf8');

      // Limit content size for preview (first 10KB)
      const maxPreviewSize = 10 * 1024;
      const truncatedContent = content.length > maxPreviewSize
        ? content.substring(0, maxPreviewSize) + '\n... (content truncated)'
        : content;

      return {
        success: true,
        content: truncatedContent,
        contentType
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update file content
   */
  async updateFileContent(userId: string, fileName: string, content: string): Promise<{
    success: boolean;
    error?: string
  }> {
    try {
      const filePath = `users/${userId}/${fileName}`;
      const file = this.bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        return { success: false, error: 'File not found' };
      }

      // Get original metadata
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'text/plain';

      // Save updated content
      await file.save(content, {
        metadata: {
          contentType,
          metadata: {
            ...metadata.metadata,
            lastModified: new Date().toISOString(),
            modifiedBy: userId
          }
        },
        resumable: false
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}