/**
 * Scraped Jobs API - Lightweight endpoint for bots to dump extracted jobs 
 * into the database BEFORE applying to them.
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

    // Only user tokens can record scraped jobs (ownership = userId)
    if (auth.user.type !== 'user') {
        return json({ success: false, error: 'Only user accounts can record scraped jobs' }, { status: 403 });
    }

    try {
        const body = await event.request.json();

        const {
            platform,
            platformJobId,
            title,
            company,
            url,
            location,
            salary,
            description,
            workMode,
            jobType,
            classification,
            postedDate,
            closingDate,
            rawData
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

        // Merge fields from rawData as fallback (bot may store them there)
        const rd = rawData || {};
        const resolvedSalary = salary || rd.salary || undefined;
        const resolvedDescription = description || rd.description || rd.details || undefined;
        const resolvedWorkMode = workMode || rd.workType || rd.work_type || undefined;
        const resolvedJobType = jobType || rd.jobType || rd.classification || rd.category || undefined;
        const resolvedPostedDate = postedDate || rd.listedDate || rd.posted_date || undefined;
        const resolvedClosingDate = closingDate || rd.closingDate || rd.closing_date || undefined;

        const db = await getDB();
        const jobModel = new JobModel(db);

        const { job, created } = await jobModel.upsertScrapedJob(auth.user.id, {
            platform,
            platformJobId,
            title,
            company,
            url,
            location: location || rd.location,
            salary: resolvedSalary,
            description: resolvedDescription,
            workMode: resolvedWorkMode,
            jobType: resolvedJobType,
            postedDate: resolvedPostedDate,
            closingDate: resolvedClosingDate,
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
        console.error('Scraped jobs POST error:', err);
        return json(
            { success: false, error: err instanceof Error ? err.message : 'Failed to record scraped job' },
            { status: 500 }
        );
    }
};
