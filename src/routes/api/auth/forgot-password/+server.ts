// Forgot Password - Request reset token
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { emailService } from '$lib/email-service.js';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email } = await request.json();

    // Validation
    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);

    // Find user
    const user = await userModel.findByEmail(email);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist or doesn't have password auth
    if (!user || !user.password) {
      console.log(`Password reset requested for non-existent/oauth-only user: ${email}`);
      return json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await userModel.setPasswordResetToken(email, resetToken, resetExpiry);

    // Send email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Continue anyway - token is saved in database
    }

    return json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return json(
      { success: false, error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
};
