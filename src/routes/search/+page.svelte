<script lang="ts">
  import NewspaperLayout from '$lib/components/NewspaperLayout.svelte';
  import { onMount } from 'svelte';

  let question = '';
  let queryResponse = '';
  let isQuerying = false;
  let searchCount = 0;
  let lastSearchTime = 'Never';
  let averageResponseTime = '0.0s';
  let queryResults: any[] = [];
  let searchHistory: Array<{
    query: string;
    time: string;
    resultCount: number;
    responseTime: string;
  }> = [];

  let isAuthenticated = false;
  let accessToken = '';

  async function performQuery() {
    if (!question.trim()) return;

    isQuerying = true;
    const startTime = Date.now();
    searchCount++;
    lastSearchTime = new Date().toLocaleTimeString();

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ question: question.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      queryResponse = data.answer || 'No answer provided';
      queryResults = data.sources || [];

      const responseTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

      // Add to search history
      searchHistory = [{
        query: question,
        time: lastSearchTime,
        resultCount: queryResults.length,
        responseTime
      }, ...searchHistory].slice(0, 10);

      // Update average response time (simple approximation)
      averageResponseTime = responseTime;

    } catch (error) {
      queryResponse = `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      queryResults = [];
    } finally {
      isQuerying = false;
    }
  }

  function setExampleQuery(exampleQuery: string) {
    question = exampleQuery;
  }

  onMount(() => {
    // Check authentication status (mock for now)
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      isAuthenticated = true;
      accessToken = stored;
    }

    // Add some mock search history
    searchHistory = [
      {
        query: 'Find documents about project management',
        time: '2:30 PM',
        resultCount: 5,
        responseTime: '0.8s'
      },
      {
        query: 'Show me reports from last quarter',
        time: '2:15 PM',
        resultCount: 3,
        responseTime: '1.2s'
      }
    ];
  });
</script>

<NewspaperLayout sectionName="Search & Intelligence Desk">
  <section class="search-section">
    <div class="section-header">
      <h1>🔍 Intelligence & Research Department</h1>
      <div class="section-subtitle">Document Query & Analysis Division</div>
      <div class="section-date">{new Date().toLocaleDateString()}</div>
    </div>

    <div class="search-content">
      <!-- Main Search Area -->
      <div class="search-main">
        <h2 class="story-headline">ADVANCED DOCUMENT SEARCH NOW OPERATIONAL</h2>

        <div class="search-story">
          <p class="lead-paragraph">
            The RAG Herald's Intelligence Desk is now fully operational, offering sophisticated
            AI-powered document search capabilities. Our advanced retrieval system can locate
            and analyze information across your entire document corpus with remarkable precision.
          </p>

          {#if isAuthenticated}
            <div class="search-interface">
              <div class="query-section">
                <h3>🎯 Search Query Interface</h3>

                <div class="example-queries">
                  <h4>Popular Search Examples:</h4>
                  <div class="query-tags">
                    <button class="query-tag" on:click={() => setExampleQuery('Find documents about project management')}>
                      Project Management
                    </button>
                    <button class="query-tag" on:click={() => setExampleQuery('Show me financial reports')}>
                      Financial Reports
                    </button>
                    <button class="query-tag" on:click={() => setExampleQuery('Find meeting notes from last month')}>
                      Meeting Notes
                    </button>
                    <button class="query-tag" on:click={() => setExampleQuery('Locate contracts and agreements')}>
                      Contracts
                    </button>
                  </div>
                </div>

                <div class="search-input-area">
                  <textarea
                    bind:value={question}
                    placeholder="Enter your search query here...
Example: 'Find documents about budget planning and financial forecasts'"
                    class="search-textarea"
                    disabled={isQuerying}
                  ></textarea>

                  <div class="search-controls">
                    <button
                      class="search-btn primary"
                      on:click={performQuery}
                      disabled={isQuerying || !question.trim()}
                    >
                      {isQuerying ? '🔄 Searching...' : '🔍 Execute Search'}
                    </button>
                    <button
                      class="search-btn secondary"
                      on:click={() => question = ''}
                      disabled={isQuerying}
                    >
                      🗑️ Clear Query
                    </button>
                  </div>
                </div>
              </div>

              {#if queryResponse}
                <div class="results-section">
                  <h3>📊 Search Results</h3>

                  <div class="response-box">
                    <h4>AI Analysis Summary:</h4>
                    <p class="response-text">{queryResponse}</p>
                  </div>

                  {#if queryResults.length > 0}
                    <div class="sources-section">
                      <h4>📄 Source Documents ({queryResults.length} found):</h4>
                      <div class="sources-list">
                        {#each queryResults as result}
                          <div class="source-item">
                            <div class="source-header">
                              <h5>{result.filename || 'Document'}</h5>
                              <span class="relevance-score">{result.score || 'N/A'}% match</span>
                            </div>
                            <p class="source-excerpt">{result.content || 'No preview available'}</p>
                            <div class="source-meta">
                              <span>Size: {result.size || 'Unknown'}</span>
                              <span>Type: {result.type || 'Unknown'}</span>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {:else}
            <div class="auth-required">
              <h3>🔒 Authentication Required</h3>
              <p>Please authenticate with Google to access the search functionality.</p>
              <a href="/auth" class="auth-link">
                → Go to Authentication Page
              </a>
            </div>
          {/if}
        </div>
      </div>

      <!-- Search Statistics Sidebar -->
      <div class="search-sidebar">
        <div class="stats-box">
          <h3>📈 Search Statistics</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-number">{searchCount}</span>
              <span class="stat-label">Queries Today</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{averageResponseTime}</span>
              <span class="stat-label">Avg Response</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{lastSearchTime}</span>
              <span class="stat-label">Last Search</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">AI-Powered</span>
              <span class="stat-label">Search Type</span>
            </div>
          </div>
        </div>

        <div class="search-history-box">
          <h3>📰 Recent Searches</h3>
          <div class="history-list">
            {#each searchHistory as search}
              <div class="history-item">
                <div class="history-query" on:click={() => setExampleQuery(search.query)}>
                  "{search.query}"
                </div>
                <div class="history-details">
                  <span>{search.time}</span>
                  <span>{search.resultCount} results</span>
                  <span>{search.responseTime}</span>
                </div>
              </div>
            {/each}
            {#if searchHistory.length === 0}
              <div class="no-history">No recent searches</div>
            {/if}
          </div>
        </div>

        <div class="search-tips-box">
          <h3>💡 Search Tips</h3>
          <div class="tips-list">
            <div class="tip-item">
              <strong>Be Specific:</strong> Use detailed queries for better results
            </div>
            <div class="tip-item">
              <strong>Use Keywords:</strong> Include important terms from your documents
            </div>
            <div class="tip-item">
              <strong>Ask Questions:</strong> Natural language queries work well
            </div>
            <div class="tip-item">
              <strong>Try Synonyms:</strong> Use different words for the same concept
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Capabilities -->
    <div class="capabilities-section">
      <h3>🎯 Advanced Search Capabilities</h3>
      <div class="capabilities-grid">
        <div class="capability-item">
          <h4>🤖 AI-Powered Analysis</h4>
          <p>Our advanced AI system understands context and meaning, not just keywords.</p>
          <ul>
            <li>Natural language processing</li>
            <li>Semantic understanding</li>
            <li>Context-aware results</li>
          </ul>
        </div>
        <div class="capability-item">
          <h4>📊 Relevance Ranking</h4>
          <p>Results are automatically ranked by relevance and importance to your query.</p>
          <ul>
            <li>Smart relevance scoring</li>
            <li>Content quality assessment</li>
            <li>Personalized rankings</li>
          </ul>
        </div>
        <div class="capability-item">
          <h4>🔍 Multi-Format Search</h4>
          <p>Search across all document types with unified results presentation.</p>
          <ul>
            <li>PDF, Word, Excel support</li>
            <li>Image text extraction</li>
            <li>Structured data analysis</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</NewspaperLayout>

<style>
  .search-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 3px solid #000;
    background: #f0fff0;
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

  .search-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
    margin-bottom: 30px;
  }

  .search-main {
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

  .lead-paragraph {
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.6;
    margin: 0 0 25px 0;
    text-align: justify;
  }

  .search-interface {
    margin-top: 25px;
  }

  .query-section {
    margin-bottom: 30px;
    padding: 20px;
    border: 2px solid #000;
    background: #f9f9f9;
  }

  .query-section h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .example-queries {
    margin-bottom: 20px;
  }

  .example-queries h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 10px 0;
    font-size: 14px;
  }

  .query-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .query-tag {
    background: #fff;
    border: 2px solid #000;
    padding: 5px 10px;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .query-tag:hover {
    background: #e0e0e0;
  }

  .search-textarea {
    width: 100%;
    height: 120px;
    border: 2px solid #000;
    padding: 15px;
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 15px;
  }

  .search-controls {
    display: flex;
    gap: 10px;
  }

  .search-btn {
    padding: 12px 20px;
    border: 2px solid #000;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-btn.primary {
    background: #007000;
    color: white;
  }

  .search-btn.primary:hover:not(:disabled) {
    background: #005000;
  }

  .search-btn.secondary {
    background: #fff;
    color: #000;
  }

  .search-btn.secondary:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .search-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-required {
    margin-top: 25px;
    padding: 20px;
    border: 2px solid #000;
    background: #fff5e6;
    text-align: center;
  }

  .auth-required h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
  }

  .auth-link {
    display: inline-block;
    margin-top: 15px;
    padding: 10px 20px;
    background: #007000;
    color: white;
    text-decoration: none;
    border: 2px solid #000;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
  }

  .results-section {
    margin-top: 30px;
    padding: 20px;
    border: 2px solid #000;
    background: #f5f5f5;
  }

  .results-section h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }

  .response-box {
    margin-bottom: 25px;
    padding: 15px;
    border: 1px solid #000;
    background: #e8f5e8;
  }

  .response-box h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 10px 0;
  }

  .response-text {
    font-family: 'Times New Roman', serif;
    line-height: 1.6;
    margin: 0;
  }

  .sources-section h4 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
  }

  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .source-item {
    border: 1px solid #000;
    padding: 15px;
    background: #fff;
  }

  .source-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .source-header h5 {
    font-family: 'Times New Roman', serif;
    margin: 0;
    font-size: 16px;
  }

  .relevance-score {
    background: #007000;
    color: white;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: bold;
  }

  .source-excerpt {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.4;
    margin: 10px 0;
    color: #333;
  }

  .source-meta {
    display: flex;
    gap: 15px;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    color: #666;
  }

  .search-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .stats-box, .search-history-box, .search-tips-box {
    border: 2px solid #000;
    padding: 20px;
    background: #f5f5f5;
  }

  .stats-box h3, .search-history-box h3, .search-tips-box h3 {
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
    font-size: 16px;
    font-family: 'Times New Roman', serif;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    font-family: 'Times New Roman', serif;
  }

  .history-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .history-item {
    margin-bottom: 15px;
    padding: 10px;
    border: 1px solid #000;
    background: #fff;
  }

  .history-query {
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    font-size: 14px;
    cursor: pointer;
    margin-bottom: 5px;
  }

  .history-query:hover {
    color: #007000;
  }

  .history-details {
    display: flex;
    justify-content: space-between;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    color: #666;
  }

  .tips-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tip-item {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.4;
  }

  .capabilities-section {
    border: 2px solid #000;
    padding: 25px;
    background: #f9f9f9;
  }

  .capabilities-section h3 {
    font-family: 'Times New Roman', serif;
    font-size: 24px;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }

  .capabilities-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
  }

  .capability-item {
    padding: 20px;
    border: 2px solid #000;
    background: #fff;
  }

  .capability-item h4 {
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .capability-item p {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.4;
    margin: 10px 0;
  }

  .capability-item ul {
    font-family: 'Times New Roman', serif;
    font-size: 13px;
    margin: 0;
    padding-left: 20px;
  }

  .capability-item li {
    margin: 3px 0;
  }

  @media (max-width: 768px) {
    .search-content {
      grid-template-columns: 1fr;
    }

    .capabilities-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }

    .query-tags {
      flex-direction: column;
    }

    .search-controls {
      flex-direction: column;
    }
  }
</style>