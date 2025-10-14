// SvelteKit Server Hooks

import { getDB } from '$lib/db/mongodb.js';
import { SessionModel } from '$lib/models/session.js';
import { UserModel } from '$lib/models/user.js';
import { redirect } from '@sveltejs/kit';

// Protected routes that require admin authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/users',
  '/jobs',
  '/upload',
  '/search',
  '/cover-letters',
  '/employer-questions',
  '/job-analysis',
  '/resume-enhancement',
  '/settings',
  '/help',
  '/profile',
  '/admin'
];

// Handle all server-side logic
export async function handle({ event, resolve }) {
  // Add CORS headers for API endpoints
  if (event.url.pathname.startsWith('/api/')) {
    // Handle preflight OPTIONS requests
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
  }

  // Check if route requires admin authentication (web UI routes)
  const isProtectedRoute = PROTECTED_ROUTES.some(route =>
    event.url.pathname === route || event.url.pathname.startsWith(route + '/')
  );

  if (isProtectedRoute) {
    // Get session token from cookie or header
    const sessionToken = event.cookies.get('session_token') ||
                        event.request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      // No session token, redirect to login
      throw redirect(303, '/');
    }

    try {
      const db = await getDB();
      const sessionModel = new SessionModel(db);
      const userModel = new UserModel(db);

      // Validate session
      const session = await sessionModel.findByToken(sessionToken);
      if (!session) {
        // Invalid or expired session
        throw redirect(303, '/');
      }

      // Get user
      const user = await userModel.findById(session.userId);
      if (!user || user.userType !== 'admin') {
        // User not found or not admin
        throw redirect(303, '/');
      }

      // Session is valid and user is admin, attach to event
      event.locals.user = {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        isPaid: user.isPaid
      };
      event.locals.session = session;

    } catch (error) {
      // If error is a redirect, throw it
      if (error instanceof Response && error.status === 303) {
        throw error;
      }
      // Otherwise, log and redirect
      console.error('Session validation error:', error);
      throw redirect(303, '/');
    }
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}
