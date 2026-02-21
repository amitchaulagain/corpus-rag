import fs from 'fs/promises';
import path from 'path';
import { closeDB, getDB } from '../src/lib/db/mongodb.js';

async function collectTxtFiles(rootDir: string): Promise<string[]> {
  const collected: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
        collected.push(fullPath);
      }
    }
  }

  try {
    await walk(rootDir);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return collected;
}

async function purgeLegacyTxtUploads() {
  const uploadsRoot = path.join(process.cwd(), 'data', 'uploads');
  const txtFiles = await collectTxtFiles(uploadsRoot);

  let filesDeleted = 0;
  for (const filePath of txtFiles) {
    await fs.unlink(filePath).catch(() => {});
    filesDeleted += 1;
  }

  const db = await getDB();
  const docCollection = db.collection('documents');
  const chunkCollection = db.collection('document_chunks');

  const docs = await docCollection.find({
    $or: [
      { localPath: { $regex: '\\.txt$', $options: 'i' } },
      { title: { $regex: '\\.txt$', $options: 'i' } }
    ]
  }).project({ _id: 1 }).toArray();

  const documentIds = docs.map((doc: any) => doc._id).filter(Boolean);
  let chunksDeleted = 0;
  if (documentIds.length > 0) {
    const chunkResult = await chunkCollection.deleteMany({ documentId: { $in: documentIds } });
    chunksDeleted = chunkResult.deletedCount ?? 0;
  }

  const docsResult = await docCollection.deleteMany({
    $or: [
      { localPath: { $regex: '\\.txt$', $options: 'i' } },
      { title: { $regex: '\\.txt$', $options: 'i' } }
    ]
  });

  console.log('✅ Legacy TXT purge complete');
  console.log(`- Files deleted: ${filesDeleted}`);
  console.log(`- Documents deleted: ${docsResult.deletedCount ?? 0}`);
  console.log(`- Chunks deleted: ${chunksDeleted}`);

  await closeDB();
}

purgeLegacyTxtUploads().catch((error) => {
  console.error('❌ Failed to purge legacy TXT uploads:', error);
  process.exit(1);
});

