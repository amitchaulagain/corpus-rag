// Migrate Generic Questions from finalboss config to corpus-rag MongoDB
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDB } from '../src/lib/db/mongodb.js';
import { GenericQuestionsModel } from '../src/lib/models/generic-questions.js';
import { UserModel } from '../src/lib/models/user.js';
import { ObjectId } from 'mongodb';

const FINALBOSS_CONFIG_PATH = join(process.cwd(), '../finalboss/src/bots/seek/config/generic_questions_config.json');

async function migrateGenericQuestions() {
  try {
    console.log('🚀 Migrating generic questions from finalboss to corpus-rag...\n');

    // Connect to MongoDB
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    // Read finalboss config file
    console.log(`📄 Reading config from: ${FINALBOSS_CONFIG_PATH}`);
    const configData = JSON.parse(readFileSync(FINALBOSS_CONFIG_PATH, 'utf-8'));
    
    const questions = configData.questions || [];
    const settings = configData.settings || { autoAnswer: false };
    
    console.log(`📋 Found ${questions.length} questions to migrate\n`);

    // Filter out empty questions
    const validQuestions = questions.filter((q: any) => 
      q.match_keywords && 
      Array.isArray(q.match_keywords) && 
      q.match_keywords.length > 0 &&
      q.match_keywords.some((k: string) => k.trim().length > 0) &&
      q.answer && 
      Array.isArray(q.answer) && 
      q.answer.length > 0 &&
      q.answer.some((a: string) => a.trim().length > 0)
    );

    console.log(`✅ ${validQuestions.length} valid questions (filtered ${questions.length - validQuestions.length} empty ones)\n`);

    // Get all users
    const users = await userModel.listAll();
    console.log(`👥 Found ${users.length} users\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found. Please create users first.');
      process.exit(1);
    }

    let migratedCount = 0;
    let skippedCount = 0;

    // Migrate questions for each user
    for (const user of users) {
      if (!user._id) continue;

      try {
        // Check if user already has questions
        const existingQuestions = await genericQuestionsModel.getAllQuestionsByUserId(user._id);
        
        if (existingQuestions.length > 0) {
          console.log(`⏭️  User ${user.email} already has ${existingQuestions.length} questions. Skipping...`);
          skippedCount++;
          continue;
        }

        // Migrate questions
        await genericQuestionsModel.syncQuestions(
          user._id,
          validQuestions.map((q: any) => ({
            questionId: q.id,
            match_keywords: q.match_keywords.filter((k: string) => k.trim().length > 0),
            answers: q.answer.filter((a: string) => a.trim().length > 0)
          }))
        );

        // Migrate settings
        await genericQuestionsModel.updateSettings(user._id, {
          autoAnswer: settings.autoAnswer ?? false
        });

        console.log(`✅ Migrated ${validQuestions.length} questions for ${user.email}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Failed to migrate for ${user.email}:`, error);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount} users`);
    console.log(`  ⏭️  Skipped: ${skippedCount} users (already have questions)`);
    console.log(`  📋 Questions per user: ${validQuestions.length}`);

    // Also create a "template" entry for viewing all questions (system-wide)
    console.log('\n📋 Creating system-wide questions list...');
    const systemUserId = new ObjectId('000000000000000000000000'); // Special ID for system
    
    // Check if system user exists, if not create a placeholder
    let systemUser = await userModel.findById(systemUserId);
    if (!systemUser) {
      // Create a system user entry (or use admin user)
      const adminUser = users.find(u => u.userType === 'admin');
      if (adminUser && adminUser._id) {
        // Store questions under admin user for viewing
        const adminQuestions = await genericQuestionsModel.getAllQuestionsByUserId(adminUser._id);
        if (adminQuestions.length === 0) {
          await genericQuestionsModel.syncQuestions(
            adminUser._id,
            validQuestions.map((q: any) => ({
              questionId: q.id,
              match_keywords: q.match_keywords.filter((k: string) => k.trim().length > 0),
              answers: q.answer.filter((a: string) => a.trim().length > 0)
            }))
          );
        }
        console.log(`✅ System questions stored under admin user`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateGenericQuestions();
