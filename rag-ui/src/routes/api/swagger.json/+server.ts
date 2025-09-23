import { json } from '@sveltejs/kit';
import { openApiSpec } from '$lib/openapi-spec.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json(openApiSpec);
};
