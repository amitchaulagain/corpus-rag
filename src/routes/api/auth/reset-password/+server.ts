// Reset Password - Use token to set new password
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token, newPassword } = await request.json();

    // Validation
    if (!token) {
      return json({ success: false, error: 'Reset token is required' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 8) {
      return json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);

    // Find user by reset token (also checks expiry)
    const user = await userModel.findByResetToken(token);
    if (!user) {
      return json({ success: false, error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await userModel.updatePassword(user._id, hashedPassword);

    // Clear reset token
    await userModel.clearPasswordResetToken(user._id);

    console.log(`Password reset successful for user: ${user.email}`);

    return json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
};
