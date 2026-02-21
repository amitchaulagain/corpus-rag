import fs from 'fs/promises';
import path from 'path';

export class LocalFileStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private async ensureUserDir(userId: string): Promise<string> {
    const userDir = path.join(this.baseDir, userId);
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
  }

  public getFilePath(userId: string, filename: string): string {
    return path.join(this.baseDir, userId, filename);
  }

  async saveFile(userId: string, file: File): Promise<string> {
    const userDir = await this.ensureUserDir(userId);
    const filePath = path.join(userDir, file.name);
    const buffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(buffer));
    return filePath;
  }

  async listFiles(userId: string): Promise<string[]> {
    const userDir = path.join(this.baseDir, userId);
    try {
      const files = await fs.readdir(userDir);
      return files;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // No directory means no files
      }
      throw error;
    }
  }

  async deleteFile(userId: string, filename: string): Promise<void> {
    const filePath = this.getFilePath(userId, filename);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File already deleted
        return;
      }
      throw error;
    }
  }

  async getFileContent(userId: string, filename: string): Promise<string> {
    const filePath = this.getFilePath(userId, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  async getFileBuffer(userId: string, filename: string): Promise<Buffer> {
    const filePath = this.getFilePath(userId, filename);
    return fs.readFile(filePath);
  }
}
