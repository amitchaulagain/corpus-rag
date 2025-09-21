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
    const { userId, question } = await request.json();

    if (!userId || !question) {
      return json({ error: 'Missing userId or question' }, { status: 400 });
    }

    const result = await rag.query({ userId, question });

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true, answer: result.answer });
  } catch (error) {
    return json({ error: 'Query failed' }, { status: 500 });
  }
};