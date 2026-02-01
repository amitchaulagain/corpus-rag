/**
 * GET /api/job-applications/:id – full detail for one job application (Job Analytics).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { JobModel } from '$lib/models/job.js';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  const id = event.params.id;
  if (!id) {
    return json({ success: false, error: 'Application ID required' }, { status: 400 });
  }

  try {
    const db = await getDB();
    const jobModel = new JobModel(db);

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return json({ success: false, error: 'Invalid application ID' }, { status: 400 });
    }

    const job = await jobModel.findById(objectId);
    if (!job) {
      return json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    if (job.userId.toString() !== auth.user.id) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return json({
      success: true,
      data: {
        _id: job._id?.toString(),
        platform: job.platform,
        platformJobId: job.platformJobId,
        title: job.title,
        company: job.company,
        url: job.url,
        description: job.description,
        location: job.location,
        salary: job.salary,
        jobType: job.jobType,
        workMode: job.workMode,
        postedDate: job.postedDate,
        closingDate: job.closingDate,
        hrContact: job.hrContact,
        requiredSkills: job.requiredSkills,
        requiredExperience: job.requiredExperience,
        jobDetails: job.jobDetails,
        status: job.status,
        application: job.application,
        rawData: job.rawData,
        firstSeenAt: job.firstSeenAt,
        lastUpdatedAt: job.lastUpdatedAt
      }
    });
  } catch (err) {
    console.error('Job application GET error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load application' },
      { status: 500 }
    );
  }
};
