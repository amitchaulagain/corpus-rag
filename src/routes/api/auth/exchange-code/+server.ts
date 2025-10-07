// OAuth code exchange endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { code, redirect_uri } = await request.json();

    if (!code || !redirect_uri) {
      return json({
        success: false,
        error: 'Missing code or redirect_uri'
      }, { status: 400 });
    }

    console.log('🔐 Exchanging OAuth code for access token...');
    console.log('Redirect URI:', redirect_uri);
    console.log('Code:', code.substring(0, 20) + '...');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: VITE_GOOGLE_CLIENT_ID,
        client_secret: VITE_GOOGLE_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('❌ Token exchange failed:', tokenData);
      return json({
        success: false,
        error: tokenData.error_description || tokenData.error || 'Failed to exchange code for token'
      }, { status: 400 });
    }

    console.log('✅ Got access token, fetching user info...');

    // Get user info using the access token
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`);
    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('❌ Failed to get user info:', userData);
      return json({
        success: false,
        error: 'Failed to get user information'
      }, { status: 400 });
    }

    console.log('✅ Successfully authenticated user:', userData.email);

    return json({
      success: true,
      data: {
        access_token: tokenData.access_token,
        user: userData
      }
    });

  } catch (error) {
    console.error('❌ OAuth exchange error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
};