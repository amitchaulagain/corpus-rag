import fs from 'fs/promises';
import path from 'path';

export class LocalFileStorage {
  private storagePath: string;

  constructor(storagePath: string = './data/uploads') {
    this.storagePath = storagePath;
  }

  async saveFile(userId: string, file: File): Promise<string> {
    const userDir = path.join(this.storagePath, userId);
    await fs.mkdir(userDir, { recursive: true });

    const filename = file.name;
    const filePath = path.join(userDir, filename);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  async getFile(userId: string, filename: string): Promise<Buffer> {
    const filePath = path.join(this.storagePath, userId, filename);
    return await fs.readFile(filePath);
  }

  async getFileContent(userId: string, filename: string): Promise<string> {
    const buffer = await this.getFile(userId, filename);
    return buffer.toString('utf-8');
  }

  async listFiles(userId: string): Promise<string[]> {
    const userDir = path.join(this.storagePath, userId);

    try {
      const files = await fs.readdir(userDir);
      return files.filter((f) => f.endsWith('.docx') || f.endsWith('.pdf') || f.endsWith('.txt'));
    } catch {
      return [];
    }
  }

  async deleteFile(userId: string, filename: string): Promise<void> {
    const filePath = path.join(this.storagePath, userId, filename);
    await fs.unlink(filePath);
  }

  async fileExists(userId: string, filename: string): Promise<boolean> {
    const filePath = path.join(this.storagePath, userId, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFilePath(userId: string, filename: string): string {
    return path.join(this.storagePath, userId, filename);
  }
}
