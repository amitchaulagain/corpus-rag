// Export entire MongoDB database (all collections)
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = 'inquisitive_mind';

async function exportFullDatabase() {
  let client: MongoClient | null = null;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);

    // Get all collection names
    const collections = await db.listCollections().toArray();
    console.log(`📦 Found ${collections.length} collections in database\n`);

    const fullExport: any = {
      database: MONGODB_DB_NAME,
      exportedAt: new Date().toISOString(),
      collections: {}
    };

    // Export each collection
    for (const collInfo of collections) {
      const collName = collInfo.name;
      const data = await db.collection(collName).find({}).toArray();
      fullExport.collections[collName] = data;
      console.log(`✅ ${collName}: ${data.length} documents`);
    }

    // Save full export
    const exportPath = path.join(__dirname, 'mongodb_full_export.json');
    fs.writeFileSync(exportPath, JSON.stringify(fullExport, null, 2));
    console.log(`\n📁 Full database exported to: ${exportPath}`);

    // Also export each collection separately
    const collectionsDir = path.join(__dirname, 'mongodb_collections');
    if (!fs.existsSync(collectionsDir)) {
      fs.mkdirSync(collectionsDir, { recursive: true });
    }

    for (const [collName, data] of Object.entries(fullExport.collections)) {
      const collPath = path.join(collectionsDir, `${collName}.json`);
      fs.writeFileSync(collPath, JSON.stringify(data, null, 2));
    }
    console.log(`📁 Individual collections saved to: ${collectionsDir}/\n`);

    // Generate summary
    console.log('📊 Database Summary:');
    console.log(`Database: ${MONGODB_DB_NAME}`);
    console.log(`Total collections: ${collections.length}`);
    let totalDocs = 0;
    for (const [collName, data] of Object.entries(fullExport.collections)) {
      const count = (data as any[]).length;
      totalDocs += count;
      console.log(`  - ${collName}: ${count} documents`);
    }
    console.log(`Total documents: ${totalDocs}`);

    console.log('\n✅ Full database export complete!');

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

exportFullDatabase();
