// Test script to verify sync fix
const { CloudVertexSyncService } = require('./src/lib/sync-service.ts');

// Mock configuration - update with your actual values for testing
const testConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id',
  bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'your-bucket-name',
  location: 'us-east4',
  apiKey: process.env.GOOGLE_CLOUD_API_KEY || 'your-api-key'
};

async function testSyncFix() {
  console.log('🧪 Testing sync fix...');

  try {
    const syncService = new CloudVertexSyncService(testConfig);

    // Test with a sample user ID
    const testUserId = 'test-user-123';

    console.log(`Testing sync for user: ${testUserId}`);

    // Test sync with waiting for completion
    const syncResult = await syncService.syncUserFiles(testUserId, true);

    console.log('Sync result:', syncResult);

    if (syncResult.success) {
      console.log('✅ Sync completed successfully!');
      console.log(`   - Synced: ${syncResult.synced}`);
      console.log(`   - Removed: ${syncResult.removed}`);
      console.log(`   - Failed: ${syncResult.failed}`);
      if (syncResult.pendingOperations) {
        console.log(`   - Pending operations: ${syncResult.pendingOperations.length}`);
      }
    } else {
      console.log('❌ Sync failed:', syncResult.error);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Only run if called directly
if (require.main === module) {
  testSyncFix();
}

module.exports = { testSyncFix };