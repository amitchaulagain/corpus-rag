// Service Account Management Endpoints
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { ServiceAccountModel } from '$lib/models/service-account';
import { authenticateJwt } from '$lib/jwt-middleware';

// List service accounts
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  // Only admins can list all, others see only their own
  const db = await getDB();
  const serviceAccountModel = new ServiceAccountModel(db);

  let accounts;
  if (auth.user.scopes.includes('admin' as any)) {
    accounts = await serviceAccountModel.listAll();
  } else {
    accounts = await serviceAccountModel.listByUser(auth.user.id);
  }

  // Remove sensitive data
  const sanitized = accounts.map(acc => ({
    id: acc._id?.toString(),
    name: acc.name,
    clientId: acc.clientId,
    scopes: acc.scopes,
    isActive: acc.isActive,
    createdAt: acc.createdAt,
    lastUsedAt: acc.lastUsedAt,
    rateLimit: acc.rateLimit
  }));

  return json({ success: true, data: { serviceAccounts: sanitized } });
};

// Create service account
export const POST: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  const body = await event.request.json();
  const { name, scopes, rateLimit } = body;

  if (!name || !Array.isArray(scopes) || scopes.length === 0) {
    return json({
      success: false,
      error: 'name and scopes required'
    }, { status: 400 });
  }

  const db = await getDB();
  const serviceAccountModel = new ServiceAccountModel(db);

  const result = await serviceAccountModel.create(name, scopes, auth.user.id, rateLimit);

  console.log(`✅ Service account created: ${name} by user ${auth.user.id}`);

  return json({
    success: true,
    data: {
      serviceAccount: {
        id: result.account._id?.toString(),
        name: result.account.name,
        clientId: result.clientId,
        clientSecret: result.clientSecret, // Shown ONCE
        scopes: result.account.scopes,
        rateLimit: result.account.rateLimit
      },
      warning: 'Save clientSecret now - it will not be shown again!'
    }
  });
};

// Revoke service account
export const DELETE: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) return auth;

  const { accountId } = await event.request.json();

  if (!accountId) {
    return json({ success: false, error: 'accountId required' }, { status: 400 });
  }

  const db = await getDB();
  const serviceAccountModel = new ServiceAccountModel(db);

  const revoked = await serviceAccountModel.revoke(accountId);

  if (!revoked) {
    return json({ success: false, error: 'Service account not found' }, { status: 404 });
  }

  console.log(`✅ Service account revoked: ${accountId} by user ${auth.user.id}`);

  return json({ success: true, data: { revoked: true } });
};
