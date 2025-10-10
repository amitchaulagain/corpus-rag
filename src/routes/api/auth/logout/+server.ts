// Logout endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db';
import { SessionModel } from '$lib/models/session';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);

    // Delete the session
    await sessionModel.deleteByToken(token);

    return json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      },
      { status: 500 }
    );
  }
};
