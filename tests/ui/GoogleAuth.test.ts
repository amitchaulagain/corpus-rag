import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import GoogleAuth from '../../src/lib/components/GoogleAuth.svelte';

// Mock Google API
const mockGoogleAuth = {
  load: vi.fn(),
  accounts: {
    id: {
      initialize: vi.fn(),
      prompt: vi.fn(),
      renderButton: vi.fn(),
    },
    oauth2: {
      initTokenClient: vi.fn(() => ({
        requestAccessToken: vi.fn(),
      })),
    },
  },
};

global.google = mockGoogleAuth as any;
global.gapi = {
  load: vi.fn((apis, callback) => callback()),
  client: {
    load: vi.fn(() => Promise.resolve()),
    init: vi.fn(() => Promise.resolve()),
    getToken: vi.fn(),
  },
  auth2: {
    getAuthInstance: vi.fn(() => ({
      signIn: vi.fn(() => Promise.resolve({
        getBasicProfile: () => ({
          getName: () => 'Test User',
          getEmail: () => 'test@example.com',
          getImageUrl: () => 'https://example.com/avatar.jpg',
        }),
        getAuthResponse: () => ({
          access_token: 'test-access-token',
        }),
      })),
      signOut: vi.fn(() => Promise.resolve()),
      isSignedIn: {
        get: vi.fn(() => false),
        listen: vi.fn(),
      },
    })),
  },
} as any;

describe('GoogleAuth Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Mock environment variables
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    // Reset localStorage
    localStorage.clear();
  });

  it('renders sign in button when not authenticated', () => {
    render(GoogleAuth);

    expect(screen.getByText(/Sign in with Google|Connect with Google|Google Sign In/)).toBeInTheDocument();
  });

  it('initializes Google API on mount', () => {
    render(GoogleAuth);

    expect(mockGoogleAuth.load).toHaveBeenCalled();
  });

  it('displays loading state during initialization', async () => {
    // Make the Google API load async
    mockGoogleAuth.load.mockImplementation((callback) => {
      setTimeout(callback, 100);
    });

    render(GoogleAuth);

    expect(screen.getByText(/Loading|Initializing/)).toBeInTheDocument();
  });

  it('handles successful authentication', async () => {
    const mockUser = {
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg',
    };

    const mockAuthResponse = {
      access_token: 'test-access-token',
    };

    // Mock successful authentication
    const mockSignIn = vi.fn(() => Promise.resolve({
      getBasicProfile: () => ({
        getName: () => mockUser.name,
        getEmail: () => mockUser.email,
        getImageUrl: () => mockUser.picture,
      }),
      getAuthResponse: () => mockAuthResponse,
    }));

    global.gapi.auth2.getAuthInstance = vi.fn(() => ({
      signIn: mockSignIn,
      signOut: vi.fn(() => Promise.resolve()),
      isSignedIn: {
        get: vi.fn(() => false),
        listen: vi.fn(),
      },
    }));

    const { component } = render(GoogleAuth);

    // Listen for the authenticated event
    const authenticatedEvent = vi.fn();
    component.$on('authenticated', authenticatedEvent);

    const signInButton = screen.getByRole('button', { name: /Sign in with Google|Connect with Google/ });
    await user.click(signInButton);

    // Wait for authentication to complete
    await vi.waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });

    // Should emit authenticated event with user data
    expect(authenticatedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          user: mockUser,
          accessToken: mockAuthResponse.access_token,
        }),
      })
    );
  });

  it('handles authentication errors', async () => {
    const mockError = new Error('Authentication failed');

    global.gapi.auth2.getAuthInstance = vi.fn(() => ({
      signIn: vi.fn(() => Promise.reject(mockError)),
      signOut: vi.fn(() => Promise.resolve()),
      isSignedIn: {
        get: vi.fn(() => false),
        listen: vi.fn(),
      },
    }));

    render(GoogleAuth);

    const signInButton = screen.getByRole('button', { name: /Sign in with Google|Connect with Google/ });
    await user.click(signInButton);

    await vi.waitFor(() => {
      expect(screen.getByText(/Authentication failed|Error signing in/)).toBeInTheDocument();
    });
  });

  it('displays user info when authenticated', async () => {
    const { rerender } = render(GoogleAuth);

    // Simulate being authenticated
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('user_data', JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
    }));

    await rerender({});

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('handles sign out', async () => {
    const mockSignOut = vi.fn(() => Promise.resolve());

    global.gapi.auth2.getAuthInstance = vi.fn(() => ({
      signIn: vi.fn(),
      signOut: mockSignOut,
      isSignedIn: {
        get: vi.fn(() => true),
        listen: vi.fn(),
      },
    }));

    // Set up authenticated state
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('user_data', JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
    }));

    render(GoogleAuth);

    const signOutButton = screen.getByRole('button', { name: /Sign out|Logout|Disconnect/ });
    await user.click(signOutButton);

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('user_data')).toBeNull();
    });
  });

  it('validates Google Client ID configuration', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    render(GoogleAuth);

    expect(screen.getByText(/Google Client ID not configured|Configuration error/)).toBeInTheDocument();
  });

  it('handles missing Google API gracefully', () => {
    // Remove Google API
    global.google = undefined;
    global.gapi = undefined;

    render(GoogleAuth);

    expect(screen.getByText(/Google API not available|Unable to load Google services/)).toBeInTheDocument();
  });

  it('preserves authentication state across page reloads', () => {
    // Simulate existing authentication
    localStorage.setItem('auth_token', 'existing-token');
    localStorage.setItem('user_data', JSON.stringify({
      name: 'Existing User',
      email: 'existing@example.com',
    }));

    render(GoogleAuth);

    expect(screen.getByText('Existing User')).toBeInTheDocument();
    expect(screen.getByText('existing@example.com')).toBeInTheDocument();
  });

  it('cleans up event listeners on destroy', () => {
    const { unmount } = render(GoogleAuth);

    // Component should clean up properly
    expect(() => unmount()).not.toThrow();
  });

  it('handles network errors during authentication', async () => {
    global.gapi.auth2.getAuthInstance = vi.fn(() => ({
      signIn: vi.fn(() => Promise.reject(new Error('Network error'))),
      signOut: vi.fn(() => Promise.resolve()),
      isSignedIn: {
        get: vi.fn(() => false),
        listen: vi.fn(),
      },
    }));

    render(GoogleAuth);

    const signInButton = screen.getByRole('button', { name: /Sign in with Google|Connect with Google/ });
    await user.click(signInButton);

    await vi.waitFor(() => {
      expect(screen.getByText(/Network error|Connection failed/)).toBeInTheDocument();
    });
  });

  it('disables button during authentication process', async () => {
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });

    global.gapi.auth2.getAuthInstance = vi.fn(() => ({
      signIn: vi.fn(() => signInPromise),
      signOut: vi.fn(() => Promise.resolve()),
      isSignedIn: {
        get: vi.fn(() => false),
        listen: vi.fn(),
      },
    }));

    render(GoogleAuth);

    const signInButton = screen.getByRole('button', { name: /Sign in with Google|Connect with Google/ });
    await user.click(signInButton);

    // Button should be disabled during authentication
    expect(signInButton).toBeDisabled();

    // Resolve the authentication
    resolveSignIn!({
      getBasicProfile: () => ({
        getName: () => 'Test User',
        getEmail: () => 'test@example.com',
        getImageUrl: () => 'https://example.com/avatar.jpg',
      }),
      getAuthResponse: () => ({
        access_token: 'test-access-token',
      }),
    });

    await vi.waitFor(() => {
      expect(signInButton).not.toBeDisabled();
    });
  });
});