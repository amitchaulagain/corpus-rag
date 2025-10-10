// Admin dashboard recent activity
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/db/user-service';

// Helper to verify admin auth
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const token = authHeader.substring(7);
  const session = await userService.findSessionByToken(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  const user = await userService.findUserById(session.userId);
  if (!user || user.userType !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user, session };
}

export const GET: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);

    const usage = await userService.getAllUsage(20);
    const users = await userService.getAllUsers();

    // Create a user ID to name map
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Usage is already sorted and limited
    const recentUsage = usage;

    // Format activity
    const activity = recentUsage.map(record => ({
      timestamp: record.timestamp,
      userName: userMap.get(record.userId) || 'Unknown User',
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
