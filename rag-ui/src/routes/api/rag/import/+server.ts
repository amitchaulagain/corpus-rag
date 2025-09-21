import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VertexRAGClient } from '$lib/rag-client';

const rag = new VertexRAGClient({
  projectId: '439974099982',
  location: 'us-east4',
  ragCorpusId: '6838716034162098176'
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, cloudStorageUris } = await request.json();

    if (!userId || !cloudStorageUris || !Array.isArray(cloudStorageUris)) {
      return json({ error: 'Missing userId or cloudStorageUris array' }, { status: 400 });
    }

    const result = await rag.importFiles({ userId, cloudStorageUris });

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      operationId: result.operationId,
      message: `Import started for ${cloudStorageUris.length} files`
    });
  } catch (error) {
    return json({ error: 'Import failed' }, { status: 500 });
  }
};