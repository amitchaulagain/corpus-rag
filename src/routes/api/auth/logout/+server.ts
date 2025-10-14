// Web UI session logout (separate from JWT API auth)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { SessionModel } from '$lib/models/session.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      const db = await getDB();
      const sessionModel = new SessionModel(db);
      await sessionModel.deleteByToken(token);
    }

    // Clear cookie
    cookies.delete('session_token', { path: '/' });

    return json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    return json({ success: false, error: 'Logout failed' }, { status: 500 });
  }
};
