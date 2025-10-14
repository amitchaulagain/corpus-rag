// Initialize JWT Authentication Collections
import { getDB, closeDatabase } from './db/mongodb';
import { RefreshTokenModel } from './models/refresh-token';
import { ServiceAccountModel } from './models/service-account';
import { RateLimitModel } from './models/rate-limit';

export async function initializeJwtCollections() {
  const db = await getDB();

  console.log('🔧 Initializing JWT authentication collections...');

  // Create indexes for new collections
  const refreshTokenModel = new RefreshTokenModel(db);
  await refreshTokenModel.createIndexes();
  console.log('✅ refresh_tokens indexes created');

  const serviceAccountModel = new ServiceAccountModel(db);
  await serviceAccountModel.createIndexes();
  console.log('✅ service_accounts indexes created');

  const rateLimitModel = new RateLimitModel(db);
  await rateLimitModel.createIndexes();
  console.log('✅ rate_limits indexes created');

  console.log('🎉 JWT system initialized successfully');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeJwtCollections()
    .then(async () => {
      await closeDatabase();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('❌ Initialization failed:', error);
      await closeDatabase();
      process.exit(1);
    });
}
