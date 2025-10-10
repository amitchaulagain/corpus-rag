// Script to migrate JSON data to MongoDB
import { readFileSync } from 'fs';
import { userService } from '../src/lib/db/user-service';
import { connectToDatabase } from '../src/lib/db/mongodb';

async function migrate() {
  console.log('🚀 Starting migration from JSON to MongoDB...\n');

  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    // Read JSON files
    const usersJson = JSON.parse(readFileSync('./data/users.json', 'utf-8'));
    const sessionsJson = JSON.parse(readFileSync('./data/sessions.json', 'utf-8'));

    console.log(`📄 Found ${usersJson.length} users to migrate`);
    console.log(`📄 Found ${sessionsJson.length} sessions to migrate\n`);

    // Migrate users
    console.log('👥 Migrating users...');
    for (const jsonUser of usersJson) {
      const existingUser = await userService.findUserByEmail(jsonUser.email);

      if (existingUser) {
        console.log(`  ⏭️  User already exists: ${jsonUser.email}`);
        continue;
      }

      const user = await userService.createUser({
        email: jsonUser.email,
        googleId: jsonUser.googleId,
        name: jsonUser.name,
        picture: jsonUser.picture,
        userType: jsonUser.userType,
        isPaid: jsonUser.isPaid,
        apiPermissions: jsonUser.apiPermissions
      });

      console.log(`  ✅ Migrated user: ${user.email}`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Users migrated: ${usersJson.length}`);
    console.log(`  - Sessions: ${sessionsJson.length} (expired, not migrated)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
