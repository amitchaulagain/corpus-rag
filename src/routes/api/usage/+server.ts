// Usage Statistics API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate } from '$lib/auth-middleware';
import { UserModel } from '$lib/models/user';
import { getDB } from '$lib/db/mongodb';

export const GET: RequestHandler = async (event) => {
  try {
    // Authenticate user
    const auth = await authenticate(event);
    
    if (!auth) {
      return json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const user = await userModel.findById(auth.user._id!);
    
    if (!user) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get usage stats
    const usage = user.usage || UserModel.getInitialUsageStats();
    const limits = user.limits || UserModel.getDefaultLimits(user.userType);
    
    // Calculate remaining
    const remaining = {
      coverLetters: limits.monthlyCoverLetters === -1 ? 'unlimited' : 
                    Math.max(0, limits.monthlyCoverLetters - (usage.cover_letters || 0)),
      resumes: limits.monthlyResumes === -1 ? 'unlimited' :
              Math.max(0, limits.monthlyResumes - (usage.resumes || 0)),
      questions: limits.monthlyQuestions === -1 ? 'unlimited' :
                Math.max(0, limits.monthlyQuestions - (usage.questions || 0))
    };
    
    return json({
      success: true,
      data: {
        usage: {
          cover_letters: usage.cover_letters || 0,
          resumes: usage.resumes || 0,
          questions: usage.questions || 0,
          totalTokens: usage.totalTokens || 0,
          totalCost: usage.totalCost || 0,
          lastReset: usage.lastReset
        },
        limits: {
          monthlyCoverLetters: limits.monthlyCoverLetters,
          monthlyResumes: limits.monthlyResumes,
          monthlyQuestions: limits.monthlyQuestions
        },
        remaining,
        userType: user.userType,
        isPaid: user.isPaid,
        isAdmin: user.userType === 'admin'
      }
    });
    
  } catch (error) {
    console.error('Usage API error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage statistics'
      },
      { status: 500 }
    );
  }
};

