// Get complete job hierarchy for a user
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/db/user-service';
import { jobService } from '$lib/db/job-service';

// Helper to verify auth
async function requireAuth(request: Request) {
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
  if (!user) {
    throw new Error('User not found');
  }

  return { user, session };
}

export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const auth = await requireAuth(request);
    const userId = url.searchParams.get('userId') || auth.user.id!;

    // Admins can view any user, others only themselves
    if (auth.user.userType !== 'admin' && userId !== auth.user.id) {
      return json(
        { success: false, error: 'Not authorized to view this user' },
        { status: 403 }
      );
    }

    // Get user platforms
    const platforms = await jobService.getUserPlatforms(userId);

    // Get all jobs for this user
    const allJobs = await jobService.getUserJobs(userId);

    // Build hierarchy: platforms -> jobs -> applications
    const hierarchy = await Promise.all(
      platforms.map(async (platform) => {
        // Get jobs for this platform
        const platformJobs = allJobs.filter(j => j.platform === platform.platform);

        // For each job, get the application details
        const jobsWithApplications = await Promise.all(
          platformJobs.map(async (job) => {
            const application = await jobService.getJobApplication(job.id!);

            return {
              job: {
                id: job.id,
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
              application: application ? {
                id: application.id,
                status: application.status,
                appliedAt: application.appliedAt,
                coverLetter: application.coverLetter,
                tailoredResume: application.tailoredResume,
                questionAnswers: application.questionAnswers,
                apiCalls: application.apiCalls,
                automationLogs: application.automationLogs,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt
              } : null
            };
          })
        );

        return {
          platform: {
            id: platform.id,
            platform: platform.platform,
            isActive: platform.isActive,
            lastSync: platform.lastSync,
            createdAt: platform.createdAt
          },
          jobs: jobsWithApplications
        };
      })
    );

    // Get stats
    const stats = await jobService.getUserStats(userId);

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
