// Admin dashboard statistics
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';
import { UsageModel } from '$lib/models/usage';

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
    const usageModel = new UsageModel(db);

    const users = await userModel.listAll();

    // Get recent usage - we'll need to aggregate across all users
    const usageCollection = db.collection('usage');
    const totalApiCalls = await usageCollection.countDocuments();

    // Count today's API calls
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayApiCalls = await usageCollection.countDocuments({
      timestamp: { $gte: today }
    });

    // Count users by type
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.userType === 'admin').length;
    const premiumUsers = users.filter(u => u.userType === 'premium').length;
    const freeUsers = users.filter(u => u.userType === 'freetier').length;

    return json({
      success: true,
      stats: {
        totalUsers,
        adminUsers,
        premiumUsers,
        freeUsers,
        totalApiCalls,
        todayApiCalls
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load stats' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};
