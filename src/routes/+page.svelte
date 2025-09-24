<script lang="ts">
  import NewspaperLayout from '$lib/components/NewspaperLayout.svelte';
  import { onMount } from 'svelte';

  let systemStats = {
    totalDocuments: 23,
    storageUsed: '2.4MB',
    lastActivity: 'Active',
    userStatus: 'Guest'
  };

  let recentActivity: Array<{
    time: string;
    action: string;
    description: string;
    type: 'upload' | 'search' | 'auth' | 'system';
  }> = [];

  let isAuthenticated = false;

  onMount(() => {
    // Mock recent activity
    recentActivity = [
      {
        time: '3:45 PM',
        action: 'Document Upload',
        description: 'project_proposal.pdf uploaded successfully',
        type: 'upload'
      },
      {
        time: '3:30 PM',
        action: 'Search Query',
        description: 'User searched for "budget analysis"',
        type: 'search'
      },
      {
        time: '3:15 PM',
        action: 'System Update',
        description: 'AI indexing system updated',
        type: 'system'
      },
      {
        time: '3:00 PM',
        action: 'User Authentication',
        description: 'New user session started',
        type: 'auth'
      }
    ];

    // Check if user is authenticated
    isAuthenticated = localStorage.getItem('auth_token') !== null;
    if (isAuthenticated) {
      systemStats.userStatus = 'Authenticated';
    }
  });

  function getActivityIcon(type: string): string {
    switch (type) {
      case 'upload': return '📤';
      case 'search': return '🔍';
      case 'auth': return '🔐';
      case 'system': return '⚙️';
      default: return '📰';
    }
  }
</script>

<NewspaperLayout sectionName="Daily Edition">
  <section class="front-page">
    <!-- Main Headlines -->
    <div class="headlines-section">
      <div class="lead-story">
        <h1 class="main-headline">
          🎉 RAG HERALD SYSTEM FULLY OPERATIONAL
        </h1>
        <div class="headline-subtext">
          Advanced Document Intelligence Platform Now Available in Organized Sections
        </div>

        <div class="lead-content">
          <p class="lead-paragraph">
            In a major development for document management, The RAG Herald announces the full deployment
            of its newspaper-style interface, featuring dedicated sections for all major operations.
            Users can now navigate seamlessly between Authentication, Upload, Search, and File Management
            departments through our revolutionary sectioned approach.
          </p>

          <div class="system-status-box">
            <h3>🏛️ System Status Report</h3>
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">Total Documents:</span>
                <span class="status-value">{systemStats.totalDocuments}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Storage Used:</span>
                <span class="status-value">{systemStats.storageUsed}</span>
              </div>
              <div class="status-item">
                <span class="status-label">System Status:</span>
                <span class="status-value status-active">{systemStats.lastActivity}</span>
              </div>
              <div class="status-item">
                <span class="status-label">User Status:</span>
                <span class="status-value" class:status-active={isAuthenticated}>
                  {systemStats.userStatus}
                </span>
              </div>
            </div>
          </div>

          {#if !isAuthenticated}
            <div class="auth-notice">
              <h4>🔐 Authentication Recommended</h4>
              <p>For full access to all RAG Herald services, please authenticate with your Google account.</p>
              <a href="/auth" class="auth-button">
                → Visit Authentication Department
              </a>
            </div>
          {/if}
        </div>
      </div>

      <!-- Section Navigation Stories -->
      <div class="section-stories">
        <div class="story-card">
          <h3>🔐 Authentication Department</h3>
          <p class="story-excerpt">
            Secure login services now available. Google OAuth integration provides
            seamless access to all Herald systems with enterprise-grade security.
          </p>
          <div class="story-meta">
            <span class="story-status">✅ Operational</span>
            <a href="/auth" class="story-link">Visit Department →</a>
          </div>
        </div>

        <div class="story-card">
          <h3>📤 Document Upload Bureau</h3>
          <p class="story-excerpt">
            Full-service document processing facility accepting all major file formats.
            Instant AI indexing and cloud storage integration available.
          </p>
          <div class="story-meta">
            <span class="story-status">✅ Accepting Files</span>
            <a href="/upload" class="story-link">Visit Bureau →</a>
          </div>
        </div>

        <div class="story-card">
          <h3>🔍 Intelligence & Research</h3>
          <p class="story-excerpt">
            Advanced AI-powered search capabilities with natural language processing.
            Real-time document analysis and intelligent result ranking.
          </p>
          <div class="story-meta">
            <span class="story-status">✅ Ready to Search</span>
            <a href="/search" class="story-link">Visit Desk →</a>
          </div>
        </div>

        <div class="story-card">
          <h3>🗄️ File Archive Management</h3>
          <p class="story-excerpt">
            Comprehensive file browser with cloud and Vertex AI integration.
            Bulk operations, sync management, and detailed analytics available.
          </p>
          <div class="story-meta">
            <span class="story-status">✅ Archive Active</span>
            <a href="/files" class="story-link">Visit Archives →</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity Section -->
    <div class="activity-section">
      <h2 class="section-headline">📰 RECENT HERALD ACTIVITY</h2>

      <div class="activity-content">
        <div class="activity-main">
          <h3>🕒 Latest System Events</h3>
          <div class="activity-timeline">
            {#each recentActivity as activity}
              <div class="activity-item">
                <div class="activity-time">{activity.time}</div>
                <div class="activity-icon">{getActivityIcon(activity.type)}</div>
                <div class="activity-details">
                  <div class="activity-action">{activity.action}</div>
                  <div class="activity-description">{activity.description}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="quick-actions">
          <h3>⚡ Quick Actions</h3>
          <div class="actions-grid">
            <a href="/auth" class="quick-action-btn">
              <span class="action-icon">🔐</span>
              <span class="action-text">Authenticate</span>
            </a>
            <a href="/upload" class="quick-action-btn">
              <span class="action-icon">📤</span>
              <span class="action-text">Upload Files</span>
            </a>
            <a href="/search" class="quick-action-btn">
              <span class="action-icon">🔍</span>
              <span class="action-text">Search Docs</span>
            </a>
            <a href="/files" class="quick-action-btn">
              <span class="action-icon">🗄️</span>
              <span class="action-text">Browse Files</span>
            </a>
          </div>

          <div class="system-info">
            <h4>🏛️ System Information</h4>
            <ul>
              <li><strong>Platform:</strong> RAG Herald v1.0</li>
              <li><strong>AI Engine:</strong> Vertex AI</li>
              <li><strong>Storage:</strong> Google Cloud</li>
              <li><strong>Security:</strong> OAuth 2.0</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Welcome Message -->
    <div class="welcome-section">
      <h2 class="welcome-headline">📰 WELCOME TO THE RAG HERALD</h2>

      <div class="welcome-content">
        <div class="welcome-text">
          <h3>Your Premier Document Intelligence Newspaper</h3>
          <p>
            The RAG Herald represents a revolutionary approach to document management,
            combining the familiar navigation of a traditional newspaper with cutting-edge
            artificial intelligence. Each section of our publication serves a specific
            purpose in your document workflow.
          </p>

          <div class="getting-started">
            <h4>🚀 Getting Started</h4>
            <ol>
              <li><strong>Authenticate:</strong> Visit our Authentication Department to secure your session</li>
              <li><strong>Upload:</strong> Submit documents through our Upload Bureau</li>
              <li><strong>Search:</strong> Query your documents via our Intelligence Desk</li>
              <li><strong>Manage:</strong> Organize files in our Archive Department</li>
            </ol>
          </div>
        </div>

        <div class="features-highlight">
          <h3>🌟 Featured Capabilities</h3>
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <div class="feature-text">
                <strong>AI-Powered Search</strong>
                <p>Natural language queries with intelligent results</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">☁️</span>
              <div class="feature-text">
                <strong>Cloud Integration</strong>
                <p>Seamless Google Cloud storage and processing</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔒</span>
              <div class="feature-text">
                <strong>Secure Access</strong>
                <p>Enterprise-grade authentication and encryption</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <div class="feature-text">
                <strong>Smart Analytics</strong>
                <p>Detailed insights into your document collection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</NewspaperLayout>

<style>
  .front-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .headlines-section {
    margin-bottom: 40px;
  }

  .lead-story {
    border: 3px solid #000;
    padding: 30px;
    margin-bottom: 30px;
    background: #fff;
  }

  .main-headline {
    font-family: 'Times New Roman', serif;
    font-size: 42px;
    font-weight: bold;
    margin: 0 0 10px 0;
    text-align: center;
    border-bottom: 4px solid #000;
    padding-bottom: 15px;
  }

  .headline-subtext {
    text-align: center;
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    font-style: italic;
    margin-bottom: 25px;
    color: #555;
  }

  .lead-paragraph {
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.7;
    text-align: justify;
    margin-bottom: 25px;
    column-count: 2;
    column-gap: 30px;
    text-indent: 20px;
  }

  .system-status-box {
    margin: 25px 0;
    padding: 20px;
    border: 2px solid #000;
    background: #f0f8ff;
  }

  .system-status-box h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    font-family: 'Times New Roman', serif;
    padding: 8px;
    border: 1px solid #000;
    background: #fff;
  }

  .status-label {
    font-weight: bold;
  }

  .status-value {
    color: #333;
  }

  .status-active {
    color: #006400 !important;
    font-weight: bold;
  }

  .auth-notice {
    margin: 25px 0;
    padding: 20px;
    border: 2px solid #000;
    background: #fff5e6;
    text-align: center;
  }

  .auth-notice h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 10px 0;
  }

  .auth-button {
    display: inline-block;
    margin-top: 15px;
    padding: 10px 20px;
    background: #007000;
    color: white;
    text-decoration: none;
    border: 2px solid #000;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    transition: background 0.2s;
  }

  .auth-button:hover {
    background: #005000;
  }

  .section-stories {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .story-card {
    border: 2px solid #000;
    padding: 20px;
    background: #f9f9f9;
  }

  .story-card h3 {
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .story-excerpt {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.5;
    margin: 10px 0 15px 0;
  }

  .story-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Times New Roman', serif;
  }

  .story-status {
    color: #006400;
    font-weight: bold;
    font-size: 12px;
  }

  .story-link {
    color: #000;
    text-decoration: none;
    font-weight: bold;
    font-size: 12px;
    border: 1px solid #000;
    padding: 5px 10px;
    background: #fff;
    transition: background 0.2s;
  }

  .story-link:hover {
    background: #e0e0e0;
  }

  .activity-section {
    margin: 40px 0;
    border: 2px solid #000;
    padding: 25px;
    background: #f5f5f5;
  }

  .section-headline {
    font-family: 'Times New Roman', serif;
    font-size: 28px;
    font-weight: bold;
    margin: 0 0 25px 0;
    text-align: center;
    border-bottom: 3px solid #000;
    padding-bottom: 10px;
  }

  .activity-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
  }

  .activity-main h3, .quick-actions h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
  }

  .activity-timeline {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .activity-item {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 15px;
    padding: 15px;
    border: 1px solid #000;
    background: #fff;
    align-items: center;
  }

  .activity-time {
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    font-size: 12px;
    min-width: 60px;
  }

  .activity-icon {
    font-size: 20px;
  }

  .activity-action {
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    font-size: 14px;
  }

  .activity-description {
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 25px;
  }

  .quick-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 15px;
    border: 2px solid #000;
    background: #fff;
    text-decoration: none;
    color: #000;
    transition: background 0.2s;
  }

  .quick-action-btn:hover {
    background: #e0e0e0;
  }

  .action-icon {
    font-size: 24px;
  }

  .action-text {
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    font-size: 12px;
  }

  .system-info {
    border: 2px solid #000;
    padding: 15px;
    background: #fff;
  }

  .system-info h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .system-info ul {
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    margin: 0;
    padding-left: 20px;
  }

  .system-info li {
    margin: 5px 0;
  }

  .welcome-section {
    margin: 40px 0;
    border: 3px solid #000;
    padding: 30px;
    background: #fff;
  }

  .welcome-headline {
    font-family: 'Times New Roman', serif;
    font-size: 32px;
    font-weight: bold;
    margin: 0 0 25px 0;
    text-align: center;
    border-bottom: 3px solid #000;
    padding-bottom: 15px;
  }

  .welcome-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }

  .welcome-text h3 {
    font-family: 'Times New Roman', serif;
    font-size: 20px;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .welcome-text p {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.6;
    text-align: justify;
    margin-bottom: 20px;
  }

  .getting-started h4 {
    font-family: 'Times New Roman', serif;
    margin: 20px 0 10px 0;
  }

  .getting-started ol {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .getting-started li {
    margin: 8px 0;
  }

  .features-highlight h3 {
    font-family: 'Times New Roman', serif;
    font-size: 20px;
    margin: 0 0 20px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .feature-item {
    display: flex;
    gap: 15px;
    padding: 15px;
    border: 1px solid #000;
    background: #f9f9f9;
  }

  .feature-icon {
    font-size: 24px;
    margin-top: 5px;
  }

  .feature-text strong {
    display: block;
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    margin-bottom: 5px;
  }

  .feature-text p {
    font-family: 'Times New Roman', serif;
    font-size: 13px;
    color: #666;
    margin: 0;
  }

  @media (max-width: 768px) {
    .lead-paragraph {
      column-count: 1;
    }

    .section-stories {
      grid-template-columns: 1fr;
    }

    .activity-content {
      grid-template-columns: 1fr;
    }

    .status-grid {
      grid-template-columns: 1fr;
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }

    .welcome-content {
      grid-template-columns: 1fr;
      gap: 30px;
    }
  }
</style>