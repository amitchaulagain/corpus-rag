import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { GenericQuestionsModel } from '$lib/models/generic-questions';
import { UserModel } from '$lib/models/user';
import { ObjectId } from 'mongodb';

// PUT /api/generic-questions/:questionId - Update a question
export const PUT: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const questionId = event.params.questionId;
    if (!questionId || !ObjectId.isValid(questionId)) {
      return json({
        success: false,
        error: 'Invalid question ID'
      }, { status: 400 });
    }

    const body = await event.request.json();
    const { match_keywords, answers, isActive } = body;

    const userId = auth.user._id || new ObjectId(auth.user.id);
    const user = await userModel.findById(userId);
    if (!user || !user._id) {
      return json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const updates: any = {};
    if (match_keywords !== undefined) {
      const sanitizedKeywords = Array.isArray(match_keywords)
        ? match_keywords.map((k: string) => String(k || '').trim()).filter((k: string) => k.length > 0)
        : [];
      if (sanitizedKeywords.length === 0) {
        return json({
          success: false,
          error: 'match_keywords must be a non-empty array'
        }, { status: 400 });
      }
      updates.match_keywords = sanitizedKeywords;
    }

    if (answers !== undefined) {
      const sanitizedAnswers = Array.isArray(answers)
        ? answers.map((a: string) => String(a || '').trim()).filter((a: string) => a.length > 0)
        : [];
      if (sanitizedAnswers.length === 0) {
        return json({
          success: false,
          error: 'answers must be a non-empty array'
        }, { status: 400 });
      }
      updates.answers = sanitizedAnswers;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    const success = await genericQuestionsModel.updateQuestion(
      new ObjectId(questionId),
      user._id,
      updates
    );

    if (!success) {
      return json({
        success: false,
        error: 'Question not found or unauthorized'
      }, { status: 404 });
    }

    const updatedQuestion = await genericQuestionsModel.getQuestionById(
      new ObjectId(questionId),
      user._id
    );

    return json({
      success: true,
      data: {
        _id: updatedQuestion?._id?.toString(),
        questionId: updatedQuestion?.questionId,
        match_keywords: updatedQuestion?.match_keywords,
        answers: updatedQuestion?.answers,
        isActive: updatedQuestion?.isActive
      }
    });
  } catch (error) {
    console.error('Failed to update generic question:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update generic question';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};

// DELETE /api/generic-questions/:questionId - Delete a question
export const DELETE: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'questionAndAnswers');
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    const userModel = new UserModel(db);

    const questionId = event.params.questionId;
    if (!questionId || !ObjectId.isValid(questionId)) {
      return json({
        success: false,
        error: 'Invalid question ID'
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

    const success = await genericQuestionsModel.deleteQuestion(
      new ObjectId(questionId),
      user._id
    );

    if (!success) {
      return json({
        success: false,
        error: 'Question not found or unauthorized'
      }, { status: 404 });
    }

    return json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete generic question:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete generic question';
    const status = errorMessage.includes('Authentication') || errorMessage.includes('Permission') ? 401 : 500;
    return json({
      success: false,
      error: errorMessage
    }, { status });
  }
};
