import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ProviderConfigManager } from '$lib/provider-config';

const configManager = new ProviderConfigManager();

// POST /api/providers/test - Test all enabled providers
export const POST: RequestHandler = async () => {
  try {
    const results = await configManager.testAll();

    return json({ success: true, results });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test providers'
      },
      { status: 500 }
    );
  }
};
