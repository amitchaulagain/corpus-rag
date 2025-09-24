<script lang="ts">
  import NewspaperLayout from '$lib/components/NewspaperLayout.svelte';
  import GoogleAuth from '$lib/components/GoogleAuth.svelte';
  import { onMount } from 'svelte';

  let isAuthenticated = false;
  let user: any = null;
  let accessToken = '';
  let authAttempts = 0;
  let lastLoginTime = 'Never';
  let authLogs: Array<{time: string, status: string, message: string}> = [];

  function handleAuthenticated(event: CustomEvent) {
    isAuthenticated = true;
    user = event.detail.user;
    accessToken = event.detail.accessToken;
    authAttempts++;
    lastLoginTime = new Date().toLocaleTimeString();

    addAuthLog('SUCCESS', `User ${user.email} authenticated successfully`);
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    accessToken = '';
    lastLoginTime = 'Logged out';

    addAuthLog('INFO', 'User logged out successfully');
  }

  function addAuthLog(status: string, message: string) {
    authLogs = [{
      time: new Date().toLocaleTimeString(),
      status,
      message
    }, ...authLogs].slice(0, 10); // Keep last 10 logs
  }

  onMount(() => {
    addAuthLog('INFO', 'Authentication system initialized');
  });
</script>

<NewspaperLayout sectionName="Authentication Department">
  <section class="auth-section">
    <div class="section-header">
      <h1>🔐 Authentication Headquarters</h1>
      <div class="section-subtitle">Security & Access Control Division</div>
      <div class="section-date">{new Date().toLocaleDateString()}</div>
    </div>

    <div class="auth-content">
      <!-- Main Story: Current Authentication Status -->
      <div class="auth-story">
        <h2 class="story-headline">
          {#if isAuthenticated}
            ✅ USER SUCCESSFULLY AUTHENTICATED
          {:else}
            🔒 AUTHENTICATION REQUIRED FOR ACCESS
          {/if}
        </h2>

        {#if isAuthenticated}
          <div class="auth-success-box">
            <h3>Welcome, {user.name}</h3>
            <div class="user-details">
              <div class="detail-item">
                <span class="detail-label">Email:</span>
                <span class="detail-value">{user.email}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Last Login:</span>
                <span class="detail-value">{lastLoginTime}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Session Status:</span>
                <span class="detail-value status-active">Active</span>
              </div>
            </div>
            <button class="logout-btn" on:click={handleLogout}>
              🚪 Sign Out
            </button>
          </div>
        {:else}
          <div class="auth-required-box">
            <h3>Secure Access Portal</h3>
            <p class="auth-description">
              The RAG Herald requires proper authentication to access our document intelligence systems.
              Please use your Google account to establish a secure connection.
            </p>

            <div class="auth-component">
              <GoogleAuth on:authenticated={handleAuthenticated} />
            </div>

            <div class="security-notice">
              <h4>🛡️ Security Notice</h4>
              <ul>
                <li>All connections are encrypted and secure</li>
                <li>Your data is protected by Google's OAuth 2.0</li>
                <li>No passwords are stored locally</li>
                <li>Session tokens expire automatically</li>
              </ul>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sidebar: Authentication Statistics -->
      <div class="auth-sidebar">
        <div class="stats-box">
          <h3>📊 Authentication Statistics</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-number">{authAttempts}</span>
              <span class="stat-label">Login Attempts</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{isAuthenticated ? '1' : '0'}</span>
              <span class="stat-label">Active Sessions</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">OAuth 2.0</span>
              <span class="stat-label">Security Protocol</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{authLogs.length}</span>
              <span class="stat-label">Log Entries</span>
            </div>
          </div>
        </div>

        <div class="auth-log-box">
          <h3>📋 Authentication Log</h3>
          <div class="log-entries">
            {#each authLogs as log}
              <div class="log-entry">
                <span class="log-time">{log.time}</span>
                <span class="log-status status-{log.status.toLowerCase()}">{log.status}</span>
                <span class="log-message">{log.message}</span>
              </div>
            {/each}
            {#if authLogs.length === 0}
              <div class="no-logs">No authentication events recorded</div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Authentication Help Section -->
    <div class="auth-help">
      <h3>❓ Authentication Help Desk</h3>
      <div class="help-columns">
        <div class="help-column">
          <h4>How to Authenticate</h4>
          <ol>
            <li>Click the "Sign in with Google" button</li>
            <li>Choose your Google account</li>
            <li>Grant necessary permissions</li>
            <li>Access granted to all systems</li>
          </ol>
        </div>
        <div class="help-column">
          <h4>Troubleshooting</h4>
          <ul>
            <li>Clear browser cache if login fails</li>
            <li>Check popup blockers</li>
            <li>Ensure JavaScript is enabled</li>
            <li>Try incognito/private mode</li>
          </ul>
        </div>
        <div class="help-column">
          <h4>Security Features</h4>
          <ul>
            <li>End-to-end encryption</li>
            <li>Automatic session timeout</li>
            <li>No local password storage</li>
            <li>Google security compliance</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</NewspaperLayout>

<style>
  .auth-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 3px solid #000;
    background: #f9f9f9;
  }

  .section-header h1 {
    font-family: 'Times New Roman', serif;
    font-size: 36px;
    margin: 0 0 10px 0;
    font-weight: bold;
  }

  .section-subtitle {
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    font-style: italic;
    margin-bottom: 10px;
  }

  .section-date {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    color: #666;
  }

  .auth-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
    margin-bottom: 30px;
  }

  .auth-story {
    border: 2px solid #000;
    padding: 25px;
    background: #fff;
  }

  .story-headline {
    font-family: 'Times New Roman', serif;
    font-size: 28px;
    font-weight: bold;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 3px solid #000;
  }

  .auth-success-box, .auth-required-box {
    padding: 20px;
    border: 2px solid #000;
    margin: 20px 0;
  }

  .auth-success-box {
    background: #e8f5e8;
  }

  .auth-required-box {
    background: #fff5e6;
  }

  .user-details {
    margin: 15px 0;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
    font-family: 'Times New Roman', serif;
  }

  .detail-label {
    font-weight: bold;
  }

  .logout-btn {
    background: #cc0000;
    color: white;
    border: 2px solid #000;
    padding: 10px 20px;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    cursor: pointer;
  }

  .logout-btn:hover {
    background: #aa0000;
  }

  .auth-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .stats-box, .auth-log-box {
    border: 2px solid #000;
    padding: 20px;
    background: #f5f5f5;
  }

  .stats-box h3, .auth-log-box h3 {
    margin: 0 0 15px 0;
    font-family: 'Times New Roman', serif;
    border-bottom: 2px solid #000;
    padding-bottom: 5px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .stat-item {
    text-align: center;
    border: 1px solid #000;
    padding: 10px;
    background: #fff;
  }

  .stat-number {
    display: block;
    font-weight: bold;
    font-size: 20px;
    font-family: 'Times New Roman', serif;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    font-family: 'Times New Roman', serif;
  }

  .log-entries {
    max-height: 300px;
    overflow-y: auto;
  }

  .log-entry {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 10px;
    padding: 8px;
    border-bottom: 1px solid #ccc;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
  }

  .log-time {
    font-weight: bold;
  }

  .log-status {
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: bold;
  }

  .status-success {
    background: #90ee90;
    color: #006400;
  }

  .status-info {
    background: #87ceeb;
    color: #000080;
  }

  .status-active {
    color: #006400;
    font-weight: bold;
  }

  .auth-help {
    border: 2px solid #000;
    padding: 25px;
    background: #f9f9f9;
  }

  .auth-help h3 {
    font-family: 'Times New Roman', serif;
    font-size: 24px;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }

  .help-columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
  }

  .help-column h4 {
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .help-column ol, .help-column ul {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    padding-left: 20px;
  }

  .help-column li {
    margin: 5px 0;
  }

  .security-notice {
    margin-top: 20px;
    padding: 15px;
    border: 2px solid #000;
    background: #e6f3ff;
  }

  .security-notice h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 10px 0;
  }

  .security-notice ul {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    margin: 0;
    padding-left: 20px;
  }

  @media (max-width: 768px) {
    .auth-content {
      grid-template-columns: 1fr;
    }

    .help-columns {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>