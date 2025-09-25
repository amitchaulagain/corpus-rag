// API Client utility for dynamic API key management

let cachedApiKey = null;

// Get the current API key from the server
export async function getApiKey() {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  try {
    const response = await fetch('/api/session');
    const data = await response.json();

    if (data.success) {
      cachedApiKey = data.data.apiKey;
      return cachedApiKey;
    } else {
      throw new Error(data.error || 'Failed to get API key');
    }
  } catch (error) {
    console.error('Failed to get API key:', error);
    throw error;
  }
}

// Clear cached API key (useful for logout or key refresh)
export function clearApiKey() {
  cachedApiKey = null;
}

// Make authenticated API request
export async function apiRequest(url, options = {}) {
  const apiKey = await getApiKey();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': options.headers?.['Content-Type'] || (options.body && !(options.body instanceof FormData) ? 'application/json' : undefined)
    }
  });
}