import fs from 'fs/promises';
import path from 'path';
import { closeDB, getDB } from '../src/lib/db/mongodb';
import { UserModel } from '../src/lib/models/user';
import { IngestionService } from '../src/lib/services/ingestion-service';

const uploadsRoot = path.resolve('data/uploads');

async function safeReadDir(targetPath: string): Promise<string[]> {
  try {
    return await fs.readdir(targetPath);
  } catch {
    return [];
  }
}

async function main() {
  const db = await getDB();
  const userModel = new UserModel(db);
  const ingestionService = new IngestionService(db);

  const userFolders = await safeReadDir(uploadsRoot);
  if (userFolders.length === 0) {
    console.log('No upload folders found, skipping RAG backfill.');
    return;
  }

  let ingested = 0;
  let skipped = 0;

  for (const folder of userFolders) {
    const user = await userModel.findByEmail(folder);
    if (!user?._id) {
      skipped += 1;
      continue;
    }

    const userFolder = path.join(uploadsRoot, folder);
    const files = await safeReadDir(userFolder);
    for (const filename of files.filter((name) => name.toLowerCase().endsWith('.txt'))) {
      const filePath = path.join(userFolder, filename);
      const text = await fs.readFile(filePath, 'utf-8');
      await ingestionService.ingestTextDocument({
        userId: user._id,
        profileId: 'default',
        title: filename,
        docType: filename.toLowerCase().includes('resume') ? 'resume' : 'other',
        source: 'upload',
        text,
        localPath: filePath,
        mimeType: 'text/plain'
      });
      ingested += 1;
      console.log(`Ingested ${folder}/${filename}`);
    }
  }

  console.log(`RAG backfill complete. ingested=${ingested} skippedUsers=${skipped}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
