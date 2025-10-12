import { json } from '@sveltejs/kit';
import { openApiSpec } from '$lib/openapi-spec';

export async function GET() {
  return json(openApiSpec);
}
