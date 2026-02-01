/**
 * Job Applications API – loosely coupled contract for recording and listing applications.
 * Used by finalboss (Seek bot) and Job Analytics UI. Auth: Bearer JWT; userId from token.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { JobModel } from '$lib/models/job.js';
import type { PlatformType } from '$lib/models/job.js';

export const POST: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  // Only user tokens can record applications (ownership = userId)
  if (auth.user.type !== 'user') {
    return json({ success: false, error: 'Only user accounts can record job applications' }, { status: 403 });
  }

  try {
    const body = await event.request.json();

    const {
      platform,
      platformJobId,
      title,
      company,
      url,
      description,
      location,
      salary,
      jobType,
      workMode,
      postedDate,
      closingDate,
      hrContact,
      requiredSkills,
      requiredExperience,
      jobDetails,
      application,
      source
    } = body;

    if (!platform || !platformJobId || !title || !company) {
      return json(
        { success: false, error: 'Missing required fields: platform, platformJobId, title, company' },
        { status: 400 }
      );
    }

    const validPlatforms: PlatformType[] = ['seek', 'linkedin', 'indeed', 'other'];
    if (!validPlatforms.includes(platform)) {
      return json({ success: false, error: 'Invalid platform' }, { status: 400 });
    }

    const db = await getDB();
    const jobModel = new JobModel(db);

    const rawData = source ? { source } : undefined;

    const { job, created } = await jobModel.upsertJobApplication(auth.user.id, {
      platform,
      platformJobId,
      title,
      company,
      url,
      description,
      location,
      salary,
      jobType,
      workMode,
      postedDate,
      closingDate,
      hrContact,
      requiredSkills,
      requiredExperience,
      jobDetails,
      application: application || {},
      rawData
    });

    return json(
      {
        success: true,
        id: job._id?.toString(),
        platformJobId: job.platformJobId,
        created
      },
      { status: created ? 201 : 200 }
    );
  } catch (err) {
    console.error('Job applications POST error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to record application' },
      { status: 500 }
    );
  }
};

export const GET: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(event.request.url);
    const platform = url.searchParams.get('platform') as PlatformType | null;
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const db = await getDB();
    const jobModel = new JobModel(db);

    const filters: { platform?: PlatformType; status?: 'pending' | 'applied' | 'rejected' | 'interview' | 'offer' | 'withdrawn' } = {};
    if (platform) filters.platform = platform;
    if (status) filters.status = status as any;

    let jobs = await jobModel.findByUserId(auth.user.id, filters);

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      jobs = jobs.filter((j) => {
        const t = j.application?.appliedAt ?? j.lastUpdatedAt;
        if (fromDate && t < fromDate) return false;
        if (toDate && t > toDate) return false;
        return true;
      });
    }

    const data = jobs.map((j) => ({
      _id: j._id?.toString(),
      platform: j.platform,
      platformJobId: j.platformJobId,
      title: j.title,
      company: j.company,
      url: j.url,
      location: j.location,
      salary: j.salary,
      jobType: j.jobType,
      status: j.status,
      application: j.application
        ? {
            appliedAt: j.application.appliedAt,
            status: j.application.status,
            questionAnswersCount: j.application.questionAnswers?.length ?? 0
          }
        : undefined,
      lastUpdatedAt: j.lastUpdatedAt
    }));

    return json({ success: true, data });
  } catch (err) {
    console.error('Job applications GET error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to list applications' },
      { status: 500 }
    );
  }
};
