// Job Application Endpoint - Demonstrates Permission-Based Access
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { JobModel } from '$lib/models/job.js';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    // Require 'jobs:apply' permission
    const auth = await requirePermission(event, 'jobs', 'apply');
    
    const { jobId, coverLetter, resume, answers } = await event.request.json();
    
    if (!jobId) {
      return json({ success: false, error: 'Job ID required' }, { status: 400 });
    }

    const db = await getDB();
    const jobModel = new JobModel(db);

    // Get job
    const job = await jobModel.findById(jobId);
    if (!job) {
      return json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    // Check if user owns the job or has permission to apply
    // (In real implementation, you'd check if job is available, etc.)
    
    // Create application
    const applicationCreated = await jobModel.createApplication(jobId, {
      status: 'pending',
      appliedAt: new Date(),
      coverLetter: coverLetter || '',
      tailoredResume: resume || '',
      questionAnswers: answers || [],
      apiCalls: [],
      automationLogs: []
    });

    if (!applicationCreated) {
      return json({ success: false, error: 'Failed to create application' }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Application submitted successfully',
      jobId,
      appliedBy: auth.user.email,
      roles: auth.roles
    });

  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Job application error:', error);
    return json({ success: false, error: 'Application failed' }, { status: 500 });
  }
};
