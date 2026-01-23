// Authentication Helper for Frontend
// Converts session tokens to JWT tokens automatically

export async function getJwtToken(): Promise<string> {
  // Check if we already have a valid JWT token cached
  let jwtToken = localStorage.getItem('jwt_token') || '';
  
  // Check if it's a valid JWT (starts with eyJ)
  if (jwtToken && jwtToken.startsWith('eyJ')) {
    // Verify it's not expired (basic check)
    try {
      const payload = JSON.parse(atob(jwtToken.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      if (Date.now() < exp) {
        return jwtToken; // Token is still valid
      }
    } catch {
      // Invalid token format, need to get new one
    }
  }

  // Get session token
  const sessionToken = localStorage.getItem('session_token') || '';
  if (!sessionToken) {
    throw new Error('No session token found. Please log in first.');
  }

  // If session token is already a JWT, return it
  if (sessionToken.startsWith('eyJ')) {
    localStorage.setItem('jwt_token', sessionToken);
    return sessionToken;
  }

  // Convert session token to JWT
  try {
    const response = await fetch('/api/auth/session-to-jwt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(errorData.error || 'Failed to convert session to JWT');
    }

    const data = await response.json();
    if (data.success && data.accessToken) {
      jwtToken = data.accessToken;
      // Cache JWT token
      localStorage.setItem('jwt_token', jwtToken);
      return jwtToken;
    }

    throw new Error('Invalid response from authentication server');
  } catch (error: any) {
    console.error('Failed to convert session to JWT:', error);
    // Clear invalid tokens
    localStorage.removeItem('jwt_token');
    throw error;
  }
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getJwtToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export function clearAuthTokens() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
}
