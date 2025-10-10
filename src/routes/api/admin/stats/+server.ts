// Admin dashboard statistics
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

    const users = await userService.getAllUsers();
    const usage = await userService.getAllUsage(1000); // Get last 1000 usage records

    // Count users by type
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.userType === 'admin').length;
    const premiumUsers = users.filter(u => u.userType === 'premium').length;
    const freeUsers = users.filter(u => u.userType === 'freetier').length;

    // Count API calls
    const totalApiCalls = usage.length;

    // Count today's API calls
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayApiCalls = usage.filter(u => {
      const timestamp = new Date(u.timestamp);
      return timestamp >= today;
    }).length;

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
