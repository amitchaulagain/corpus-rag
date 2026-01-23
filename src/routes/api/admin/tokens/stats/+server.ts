// Admin: Get token statistics
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/auth-middleware';
import { TokenService } from '$lib/services/token-service';
import { connectToDatabase } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';

export const GET: RequestHandler = async (event) => {
  try {
    await requireAdmin(event);

    // Get query parameters
    const url = new URL(event.request.url);
    const startDate = url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : undefined;
    const endDate = url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : undefined;

    // Get token service
    const tokenService = await TokenService.create();

    // Get all users for aggregate stats
    const db = await connectToDatabase();
    const userModel = new UserModel(db);
    const users = await userModel.listAll();

    // Calculate aggregate statistics
    let totalTokensPurchased = 0;
    let totalTokensUsed = 0;
    let totalTokensRemaining = 0;
    const userStats: any[] = [];

    for (const user of users) {
      const stats = await tokenService.getUsageStats(user._id!, startDate, endDate);
      const balance = await tokenService.getBalance(user._id!);

      totalTokensPurchased += stats.totalPurchased;
      totalTokensUsed += stats.totalUsed;
      totalTokensRemaining += balance;

      userStats.push({
        userId: user._id?.toString(),
        email: user.email,
        name: user.name,
        tokenBalance: balance,
        totalPurchased: stats.totalPurchased,
        totalUsed: stats.totalUsed,
        stats
      });
    }

    // Sort by total purchased (descending)
    userStats.sort((a, b) => b.totalPurchased - a.totalPurchased);

    return json({
      success: true,
      data: {
        totalTokensPurchased,
        totalTokensUsed,
        totalTokensRemaining,
        totalUsers: users.length,
        topUsers: userStats.slice(0, 10), // Top 10 users
        usageByType: {
          purchase: userStats.reduce((sum, u) => sum + u.stats.byType.purchase, 0),
          usage: userStats.reduce((sum, u) => sum + u.stats.byType.usage, 0),
          refund: userStats.reduce((sum, u) => sum + u.stats.byType.refund, 0),
          bonus: userStats.reduce((sum, u) => sum + u.stats.byType.bonus, 0),
          adjustment: userStats.reduce((sum, u) => sum + u.stats.byType.adjustment, 0)
        }
      }
    });
  } catch (error: any) {
    return json(
      {
        success: false,
        error: error.message || 'Failed to get token statistics'
      },
      { status: error.message?.includes('Admin') ? 403 : 500 }
    );
  }
};
