import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { GenericQuestionsModel } from '$lib/models/generic-questions';
import { UserModel } from '$lib/models/user';
import { ObjectId } from 'mongodb';

// POST /api/generic-questions/sync - Sync questions from finalboss
export const POST: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const body = await event.request.json();
    const { questions, settings } = body;

    if (!questions || !Array.isArray(questions)) {
      return json({
        success: false,
        error: 'questions is required and must be an array'
      }, { status: 400 });
    }

    const user = await userModel.findById(new ObjectId(auth.user._id));
    if (!user || !user._id) {
      return json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Sync questions
    await genericQuestionsModel.syncQuestions(
      user._id,
      questions.map((q: any) => ({
        questionId: q.id || q.questionId,
        match_keywords: Array.isArray(q.match_keywords) ? q.match_keywords : [],
        answers: Array.isArray(q.answer || q.answers) ? (q.answer || q.answers) : []
      }))
    );

    // Sync settings if provided
    if (settings) {
      await genericQuestionsModel.updateSettings(user._id, {
        autoAnswer: settings.autoAnswer ?? false
      });
    }

    return json({
      success: true,
      message: 'Questions synced successfully',
      data: {
        syncedCount: questions.length
      }
    });
  } catch (error) {
    console.error('Failed to sync generic questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync generic questions';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};
