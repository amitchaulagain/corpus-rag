// Get complete job hierarchy for a user
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';
import { JobModel } from '$lib/models/job';

// Helper to verify auth
async function requireAuth(request: Request) {
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
  if (!user) {
    throw new Error('User not found');
  }

  return { user, session };
}

export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const auth = await requireAuth(request);
    const db = await getDB();
    const jobModel = new JobModel(db);

    const requestedUserId = url.searchParams.get('userId');
    const userId = requestedUserId || auth.user._id!.toString();

    // Admins can view any user, others only themselves
    if (auth.user.userType !== 'admin' && userId !== auth.user._id!.toString()) {
      return json(
        { success: false, error: 'Not authorized to view this user' },
        { status: 403 }
      );
    }

    // Get all jobs for this user (with embedded applications)
    const allJobs = await jobModel.findByUserId(userId);

    // Group jobs by platform
    const platformMap = new Map();

    allJobs.forEach(job => {
      if (!platformMap.has(job.platform)) {
        platformMap.set(job.platform, []);
      }
      platformMap.get(job.platform).push({
        job: {
          id: job._id?.toString(),
          platformJobId: job.platformJobId,
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary,
          status: job.status,
          url: job.url,
          firstSeenAt: job.firstSeenAt,
          lastUpdatedAt: job.lastUpdatedAt
        },
        application: job.application || null
      });
    });

    // Build hierarchy: platforms -> jobs -> applications
    const hierarchy = Array.from(platformMap.entries()).map(([platform, jobs]) => ({
      platform: {
        platform: platform,
        jobCount: jobs.length
      },
      jobs: jobs
    }));

    // Get stats
    const stats = await jobModel.getStats(userId);

    return json({
      success: true,
      userId,
      stats,
      hierarchy
    });

  } catch (error) {
    console.error('Job hierarchy error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load job hierarchy' },
      { status: error instanceof Error && error.message.includes('authorized') ? 403 : 500 }
    );
  }
};
