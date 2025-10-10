// Script to migrate JSON data to MongoDB
import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import { randomBytes } from 'crypto';

const MONGODB_URI = 'mongodb://localhost:27017';
const MONGODB_DB_NAME = 'corpus_rag';

async function migrate() {
  console.log('🚀 Starting migration from JSON to MongoDB...\n');

  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    console.log('✅ Connected to MongoDB:', MONGODB_DB_NAME, '\n');

    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    console.log('✅ Created indexes\n');

    // Read JSON files
    const usersJson = JSON.parse(readFileSync('./data/users.json', 'utf-8'));
    const sessionsJson = JSON.parse(readFileSync('./data/sessions.json', 'utf-8'));

    console.log(`📄 Found ${usersJson.length} users to migrate`);
    console.log(`📄 Found ${sessionsJson.length} sessions to migrate\n`);

    // Migrate users
    console.log('👥 Migrating users...');
    for (const jsonUser of usersJson) {
      const existingUser = await db.collection('users').findOne({ email: jsonUser.email });

      if (existingUser) {
        console.log(`  ⏭️  User already exists: ${jsonUser.email}`);
        continue;
      }

      const user = {
        email: jsonUser.email,
        googleId: jsonUser.googleId,
        name: jsonUser.name,
        picture: jsonUser.picture,
        userType: jsonUser.userType,
        isPaid: jsonUser.isPaid,
        apiPermissions: jsonUser.apiPermissions,
        createdAt: new Date(jsonUser.createdAt),
        lastLogin: new Date(jsonUser.lastLogin)
      };

      await db.collection('users').insertOne(user);
      console.log(`  ✅ Migrated user: ${user.email}`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Users migrated: ${usersJson.length}`);
    console.log(`  - Sessions: ${sessionsJson.length} (expired, not migrated - new sessions will be created on login)`);

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (client) await client.close();
    process.exit(1);
  }
}

migrate();
