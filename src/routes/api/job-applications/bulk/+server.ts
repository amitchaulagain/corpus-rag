import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { ObjectId } from 'mongodb';

export const DELETE: RequestHandler = async (event) => {
    const auth = await authenticateJwt(event);
    if (auth instanceof Response) return auth;

    try {
        const { jobIds } = await event.request.json();

        if (!Array.isArray(jobIds) || jobIds.length === 0) {
            return json({ success: false, error: 'jobIds array is required' }, { status: 400 });
        }

        const db = await getDB();
        const objectIds = jobIds.map((id: string) => {
            try { return new ObjectId(id); } catch (e) { return null; }
        }).filter((id: unknown): id is ObjectId => id !== null);

        // Only allow users to delete their own scraped jobs
        const result = await db.collection('jobs').deleteMany({
            _id: { $in: objectIds },
            userId: auth.user.id,
            status: 'scraped'
        });

        return json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Job applications bulk DELETE error:', err);
        return json(
            { success: false, error: err instanceof Error ? err.message : 'Failed to delete jobs' },
            { status: 500 }
        );
    }
};
