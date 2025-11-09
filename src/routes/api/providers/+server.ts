import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ProviderConfigManager } from '$lib/provider-config';

const configManager = new ProviderConfigManager();

// GET /api/providers - List all providers
export const GET: RequestHandler = async () => {
  try {
    const providers = await configManager.loadProviders();

    // Don't expose API keys to client
    const safe = providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      model: p.model,
      enabled: p.enabled,
      hasApiKey: !!p.apiKey || p.type === 'ollama' // Ollama doesn't need API key
    }));

    return json({ success: true, providers: safe });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load providers'
      },
      { status: 500 }
    );
  }
};

// POST /api/providers - Add or update provider
export const POST: RequestHandler = async ({ request }) => {
  try {
    const provider = await request.json();

    if (!provider.id || !provider.name || !provider.type) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    await configManager.saveProvider(provider);

    return json({ success: true });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save provider'
      },
      { status: 500 }
    );
  }
};

// PATCH /api/providers - Update provider
export const PATCH: RequestHandler = async ({ request }) => {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return json({ success: false, error: 'Provider ID required' }, { status: 400 });
    }

    await configManager.updateProvider(id, updates);

    return json({ success: true });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update provider'
      },
      { status: 500 }
    );
  }
};

// DELETE /api/providers - Delete provider
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();

    if (!id) {
      return json({ success: false, error: 'Provider ID required' }, { status: 400 });
    }

    await configManager.deleteProvider(id);

    return json({ success: true });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete provider'
      },
      { status: 500 }
    );
  }
};
