// Service Account Token Endpoint (OAuth 2.0 Client Credentials Flow)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { ServiceAccountModel } from '$lib/models/service-account';
import { JwtAuth } from '$lib/jwt-auth';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { grant_type, client_id, client_secret } = await request.json();

    if (grant_type !== 'client_credentials') {
      return json({
        success: false,
        error: 'Unsupported grant_type. Use "client_credentials"'
      }, { status: 400 });
    }

    if (!client_id || !client_secret) {
      return json({
        success: false,
        error: 'client_id and client_secret required'
      }, { status: 400 });
    }

    const db = await getDB();
    const serviceAccountModel = new ServiceAccountModel(db);

    // Validate credentials
    const account = await serviceAccountModel.validateCredentials(client_id, client_secret);

    if (!account) {
      return json({
        success: false,
        error: 'Invalid credentials'
      }, { status: 401 });
    }

    // Generate access token (no refresh token for service accounts)
    const accessToken = JwtAuth.generateServiceAccountToken(
      account._id!.toString(),
      account.scopes
    );

    console.log(`✅ Service account token issued: ${account.name} (${account.clientId.substring(0, 8)}...)`);

    return json({
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: accessToken.expiresIn,
      scope: account.scopes.join(' ')
    });

  } catch (error) {
    console.error('Service account token error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Token generation failed'
    }, { status: 500 });
  }
};
