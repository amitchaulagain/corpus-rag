// Admin dashboard recent activity
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';

// Helper to verify admin auth
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const db = await getDB();
  const sessionModel = new SessionModel(db);
  const userModel = new UserModel(db);

  const token = authHeader.substring(7);
  const session = await sessionModel.findByToken(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  const user = await userModel.findById(session.userId);
  if (!user || user.userType !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user, session };
}

export const GET: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);

    const db = await getDB();
    const userModel = new UserModel(db);

    // Get recent usage records
    const usageRecords = await db.collection('usage')
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    const users = await userModel.listAll();

    // Create a user ID to name map
    const userMap = new Map(users.map(u => [u._id?.toString(), u.name]));

    // Format activity
    const activity = usageRecords.map(record => ({
      timestamp: record.timestamp,
      userName: userMap.get(record.userId?.toString()) || 'Unknown User',
      action: `${record.endpoint} (${record.aiProvider})`,
      success: record.success
    }));

    return json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Activity error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load activity' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};
