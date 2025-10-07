// API endpoint for manually syncing cloud storage files to Vertex AI
import { json } from '@sveltejs/kit';
import { CloudVertexSyncService } from '$lib/sync-service.js';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const syncService = new CloudVertexSyncService({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, waitForCompletion = true } = await request.json();

    if (!userId) {
      return json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    console.log(`🔄 Starting manual sync for user: ${userId} (wait: ${waitForCompletion})`);

    const syncResult = await syncService.syncUserFiles(userId, waitForCompletion);

    if (!syncResult.success) {
      return json({
        success: false,
        error: `Sync failed: ${syncResult.error}`
      }, { status: 500 });
    }

    console.log(`✅ Manual sync completed for user ${userId}:`, syncResult);

    return json({
      success: true,
      message: `Sync completed for user ${userId}`,
      synced: syncResult.synced,
      removed: syncResult.removed,
      failed: syncResult.failed,
      pendingOperations: syncResult.pendingOperations,
      details: {
        waitedForCompletion: waitForCompletion,
        hasFailures: syncResult.failed > 0,
        hasPendingOperations: (syncResult.pendingOperations?.length || 0) > 0
      }
    });

  } catch (error) {
    console.error('Manual sync error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};