// src/routes/api/swagger-token/+server.ts
import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
  // Only allow admins
  if (!locals.user || locals.user.userType !== 'admin') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return a “token” for Swagger
  return json({
    token: locals.session?.token || locals.session?.sessionToken || '', 
    // or generate a JWT for Swagger if needed
  });
}
