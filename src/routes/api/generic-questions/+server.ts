import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { GenericQuestionsModel } from '$lib/models/generic-questions';
import { UserModel } from '$lib/models/user';
import { ObjectId } from 'mongodb';

// GET /api/generic-questions - Get all generic questions for authenticated user
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const userId = auth.user._id || new ObjectId(auth.user.id);
    const user = await userModel.findById(userId);
    if (!user || !user._id) {
      return json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const questions = await genericQuestionsModel.getAllQuestionsByUserId(user._id);
    const settings = await genericQuestionsModel.getSettings(user._id);

    return json({
      success: true,
      data: {
        questions: questions.map(q => ({
          _id: q._id?.toString(),
          questionId: q.questionId,
          match_keywords: q.match_keywords,
          answers: q.answers,
          isActive: q.isActive
        })),
        settings: settings ? {
          autoAnswer: settings.autoAnswer,
          lastUpdated: settings.lastUpdated
        } : {
          autoAnswer: false,
          lastUpdated: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Failed to get generic questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get generic questions';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};

// POST /api/generic-questions - Create a new generic question
export const POST: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const body = await event.request.json();
    const { match_keywords, answers, questionId } = body;
    const sanitizedKeywords = Array.isArray(match_keywords)
      ? match_keywords.map((k: string) => String(k || '').trim()).filter((k: string) => k.length > 0)
      : [];
    const sanitizedAnswers = Array.isArray(answers)
      ? answers.map((a: string) => String(a || '').trim()).filter((a: string) => a.length > 0)
      : [];

    if (sanitizedKeywords.length === 0) {
      return json({
        success: false,
        error: 'match_keywords is required and must be a non-empty array'
      }, { status: 400 });
    }

    if (sanitizedAnswers.length === 0) {
      return json({
        success: false,
        error: 'answers is required and must be a non-empty array'
      }, { status: 400 });
    }

    const userId = auth.user._id || new ObjectId(auth.user.id);
    const user = await userModel.findById(userId);
    if (!user || !user._id) {
      return json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const questionId_obj = await genericQuestionsModel.createQuestion({
      userId: user._id,
      questionId: questionId,
      match_keywords: sanitizedKeywords,
      answers: sanitizedAnswers,
      isActive: true
    });

    return json({
      success: true,
      data: {
        _id: questionId_obj.toString(),
        questionId,
        match_keywords: sanitizedKeywords,
        answers: sanitizedAnswers,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Failed to create generic question:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create generic question';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};

// PUT /api/generic-questions - Update settings
export const PUT: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const body = await event.request.json();

    // Handle settings update
    if (body.type === 'settings') {
      const userId = auth.user._id || new ObjectId(auth.user.id);
      const user = await userModel.findById(userId);
      if (!user || !user._id) {
        return json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      await genericQuestionsModel.updateSettings(user._id, {
        autoAnswer: body.settings?.autoAnswer ?? false
      });

      return json({
        success: true,
        data: {
          settings: {
            autoAnswer: body.settings?.autoAnswer ?? false
          }
        }
      });
    }

    return json({
      success: false,
      error: 'Invalid request type. Use type: "settings" for settings updates'
    }, { status: 400 });
  } catch (error) {
    console.error('Failed to update settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update settings';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};
