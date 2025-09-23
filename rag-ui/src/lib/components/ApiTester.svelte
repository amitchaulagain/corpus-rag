<!-- Sleek API Tester Component for Main UI -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { openApiSpec } from '../openapi-spec.js';
  import { ApiAuth } from '../api-auth.js';

  let apiKey = '';
  let selectedEndpoint = '';
  let selectedMethod = '';
  let requestBody = '';
  let responseData = '';
  let isLoading = false;
  let isGeneratingKey = false;

  // API Key Generation
  let keyName = 'Test API Key';
  let selectedScopes: string[] = ['files:read', 'files:write', 'rag:query'];
  let showKeyGenerator = false;

  const availableScopes = [
    { id: 'files:read', label: '📖 Read Files' },
    { id: 'files:write', label: '✏️ Write Files' },
    { id: 'files:delete', label: '🗑️ Delete Files' },
    { id: 'corpus:read', label: '📚 Read Corpus' },
    { id: 'corpus:write', label: '📝 Write Corpus' },
    { id: 'rag:query', label: '🤔 RAG Query' },
    { id: 'rag:import', label: '📥 RAG Import' },
    { id: 'system:status', label: '📊 System Status' }
  ];

  interface EndpointInfo {
    path: string;
    method: string;
    summary: string;
    description: string;
    tags: string[];
  }

  let endpoints: EndpointInfo[] = [];
  let filteredEndpoints: EndpointInfo[] = [];
  let searchTerm = '';
  let selectedTag = 'All';

  onMount(async () => {
    // Load test credentials
    await loadTestCredentials();

    // Parse OpenAPI spec
    endpoints = Object.entries(openApiSpec.paths).flatMap(([path, pathObj]) =>
      Object.entries(pathObj as any).map(([method, methodObj]: [string, any]) => ({
        path,
        method: method.toUpperCase(),
        summary: methodObj.summary || '',
        description: methodObj.description || '',
        tags: methodObj.tags || []
      }))
    );
    filterEndpoints();
  });

  async function loadTestCredentials() {
    try {
      const response = await fetch('/api/auth/test-key');
      const data = await response.json();

      if (data.success) {
        apiKey = data.data.apiKey;
        console.log('🔑 Auto-loaded test API key for ApiTester');
      }
    } catch (error) {
      console.warn('Failed to load test credentials:', error);
    }
  }

  function filterEndpoints() {
    filteredEndpoints = endpoints.filter(endpoint => {
      const matchesSearch = searchTerm === '' ||
        endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTag = selectedTag === 'All' || endpoint.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }

  function selectEndpoint(endpoint: EndpointInfo) {
    selectedEndpoint = endpoint.path;
    selectedMethod = endpoint.method;

    // Generate example request body
    if (endpoint.method !== 'GET') {
      if (endpoint.path.includes('/query')) {
        requestBody = JSON.stringify({
          userId: 'test-user@example.com',
          question: 'What skills do I have?'
        }, null, 2);
      } else if (endpoint.path.includes('/import')) {
        requestBody = JSON.stringify({
          userId: 'test-user@example.com',
          cloudStorageUris: ['gs://bucket/user/file.pdf']
        }, null, 2);
      } else if (endpoint.path.includes('/corpus')) {
        requestBody = JSON.stringify({
          userId: 'test-user@example.com',
          action: 'get_or_create'
        }, null, 2);
      } else {
        requestBody = JSON.stringify({
          userId: 'test-user@example.com'
        }, null, 2);
      }
    } else {
      requestBody = '';
    }

    responseData = '';
  }

  async function generateApiKey() {
    if (!keyName || selectedScopes.length === 0) return;

    isGeneratingKey = true;
    try {
      const generatedKey = ApiAuth.generateApiKey('test-user@example.com', keyName, selectedScopes as any);
      apiKey = generatedKey.key;
      showKeyGenerator = false;
    } catch (error) {
      console.error('Failed to generate API key:', error);
    } finally {
      isGeneratingKey = false;
    }
  }

  async function testEndpoint() {
    if (!selectedEndpoint || !selectedMethod) return;

    isLoading = true;
    responseData = '';

    try {
      const url = `/api${selectedEndpoint}`;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const config: RequestInit = {
        method: selectedMethod,
        headers
      };

      if (requestBody && selectedMethod !== 'GET') {
        if (selectedEndpoint === '/files' && selectedMethod === 'POST') {
          // Handle file upload differently
          const formData = new FormData();
          formData.append('userId', 'test-user@example.com');
          const testFile = new File(['Sample test content'], 'test.txt', { type: 'text/plain' });
          formData.append('file', testFile);
          config.body = formData;
        } else {
          headers['Content-Type'] = 'application/json';
          config.body = requestBody;
        }
      }

      const response = await fetch(url, config);
      const data = await response.text();

      try {
        const jsonData = JSON.parse(data);
        responseData = JSON.stringify(jsonData, null, 2);
      } catch {
        responseData = data;
      }

    } catch (error) {
      responseData = JSON.stringify({
        error: error instanceof Error ? error.message : 'Request failed',
        timestamp: new Date().toISOString()
      }, null, 2);
    } finally {
      isLoading = false;
    }
  }

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey);
  }

  function copyResponse() {
    navigator.clipboard.writeText(responseData);
  }

  $: tags = ['All', ...new Set(endpoints.flatMap(ep => ep.tags))];
  $: searchTerm, selectedTag, filterEndpoints();
</script>

<div class="api-tester">
  <!-- Header -->
  <div class="header">
    <div class="title-section">
      <h2>🚀 API Testing Studio</h2>
      <p>Test your RAG API endpoints with live requests</p>
    </div>

    <div class="quick-actions">
      <button
        class="btn-secondary"
        on:click={() => showKeyGenerator = !showKeyGenerator}
      >
        🔑 {showKeyGenerator ? 'Hide' : 'Generate'} API Key
      </button>
    </div>
  </div>

  <!-- API Key Generator -->
  {#if showKeyGenerator}
    <div class="key-generator glass-card">
      <h3>🔑 Generate Test API Key</h3>

      <div class="form-row">
        <input
          type="text"
          bind:value={keyName}
          placeholder="API Key Name"
          class="input-field"
        />
      </div>

      <div class="scopes-section">
        <label class="field-label">Scopes:</label>
        <div class="scopes-grid">
          {#each availableScopes as scope}
            <label class="scope-checkbox">
              <input
                type="checkbox"
                bind:group={selectedScopes}
                value={scope.id}
              />
              <span class="scope-label">{scope.label}</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn-primary"
          on:click={generateApiKey}
          disabled={isGeneratingKey || !keyName || selectedScopes.length === 0}
        >
          {isGeneratingKey ? '⏳ Generating...' : '🎯 Generate Key'}
        </button>
      </div>
    </div>
  {/if}

  <!-- API Key Input -->
  <div class="api-key-section glass-card">
    <div class="input-group">
      <label for="api-key" class="field-label">
        🔐 API Key:
        {#if apiKey && apiKey.startsWith('rag_')}
          <span class="auto-loaded-badge">✨ Auto-loaded</span>
        {/if}
      </label>
      <div class="key-input-wrapper">
        <input
          type="password"
          id="api-key"
          bind:value={apiKey}
          placeholder="rag_[keyId]_[secret] or generate one above"
          class="input-field key-input"
        />
        {#if apiKey}
          <button class="copy-btn" on:click={copyApiKey} title="Copy API Key">📋</button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Endpoint Selection -->
  <div class="endpoint-section glass-card">
    <div class="section-header">
      <h3>📡 Select Endpoint</h3>

      <div class="filters">
        <div class="search-group">
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="🔍 Search endpoints..."
            class="search-input"
          />
        </div>

        <select bind:value={selectedTag} class="tag-filter">
          {#each tags as tag}
            <option value={tag}>{tag}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="endpoints-grid">
      {#each filteredEndpoints as endpoint}
        <button
          class="endpoint-card"
          class:selected={selectedEndpoint === endpoint.path && selectedMethod === endpoint.method}
          on:click={() => selectEndpoint(endpoint)}
        >
          <div class="endpoint-info">
            <span class="method-badge method-{endpoint.method.toLowerCase()}">{endpoint.method}</span>
            <div class="endpoint-details">
              <div class="endpoint-path">{endpoint.path}</div>
              <div class="endpoint-summary">{endpoint.summary}</div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Request/Response Section -->
  {#if selectedEndpoint}
    <div class="testing-section">
      <div class="request-section glass-card">
        <h3>📤 Request</h3>
        <div class="request-info">
          <span class="method-badge method-{selectedMethod.toLowerCase()}">{selectedMethod}</span>
          <span class="endpoint-url">/api{selectedEndpoint}</span>
        </div>

        {#if requestBody}
          <div class="body-section">
            <label class="field-label">Request Body:</label>
            <textarea
              bind:value={requestBody}
              class="json-editor"
              rows="8"
              placeholder="Enter JSON request body..."
            ></textarea>
          </div>
        {/if}

        <div class="action-section">
          <button
            class="btn-primary execute-btn"
            on:click={testEndpoint}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? '⏳ Executing...' : '🚀 Execute Request'}
          </button>
          {#if !apiKey}
            <span class="warning-text">⚠️ API key required</span>
          {/if}
        </div>
      </div>

      <div class="response-section glass-card">
        <div class="response-header">
          <h3>📥 Response</h3>
          {#if responseData}
            <button class="copy-btn" on:click={copyResponse} title="Copy Response">📋</button>
          {/if}
        </div>

        {#if responseData}
          <pre class="response-data">{responseData}</pre>
        {:else if isLoading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Executing request...</p>
          </div>
        {:else}
          <div class="empty-state">
            <p>📭 Response will appear here after executing a request</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .api-tester {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    color: white;
  }

  .title-section h2 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    font-weight: 700;
  }

  .title-section p {
    margin: 0;
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .quick-actions {
    display: flex;
    gap: 12px;
  }

  .btn-primary, .btn-secondary {
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .key-generator {
    border-left: 4px solid #28a745;
  }

  .key-generator h3 {
    margin: 0 0 20px 0;
    color: #2c3e50;
    font-size: 1.3rem;
  }

  .form-row {
    margin-bottom: 20px;
  }

  .input-field {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    font-size: 14px;
    transition: all 0.3s ease;
    background: white;
  }

  .input-field:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .scopes-section {
    margin-bottom: 20px;
  }

  .field-label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: #2c3e50;
    font-size: 14px;
  }

  .scopes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .scope-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .scope-checkbox:hover {
    background: #e7f3ff;
    border-color: #667eea;
  }

  .scope-checkbox input:checked + .scope-label {
    color: #667eea;
    font-weight: 600;
  }

  .scope-label {
    font-size: 14px;
    color: #495057;
  }

  .api-key-section .input-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .key-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .key-input {
    padding-right: 50px;
  }

  .copy-btn {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.6;
    transition: opacity 0.3s ease;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .section-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.3rem;
  }

  .filters {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .search-input, .tag-filter {
    padding: 10px 14px;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    font-size: 14px;
    background: white;
  }

  .search-input {
    width: 250px;
  }

  .tag-filter {
    min-width: 120px;
  }

  .endpoints-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 12px;
  }

  .endpoint-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    width: 100%;
  }

  .endpoint-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
  }

  .endpoint-card.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, #e7f3ff 0%, #f0f8ff 100%);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
  }

  .endpoint-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .method-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    min-width: 60px;
    text-align: center;
  }

  .method-get { background: #e7f3ff; color: #0969da; }
  .method-post { background: #e6ffed; color: #1a7f37; }
  .method-put { background: #fff8e1; color: #9a6700; }
  .method-delete { background: #ffebe9; color: #cf222e; }

  .endpoint-details {
    flex: 1;
  }

  .endpoint-path {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 4px;
  }

  .endpoint-summary {
    font-size: 13px;
    color: #6c757d;
  }

  .testing-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .request-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 12px;
  }

  .endpoint-url {
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 600;
    color: #495057;
  }

  .body-section {
    margin-bottom: 20px;
  }

  .json-editor {
    width: 100%;
    padding: 16px;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    background: #f8f9fa;
  }

  .json-editor:focus {
    outline: none;
    border-color: #667eea;
    background: white;
  }

  .action-section {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .execute-btn {
    font-size: 16px;
    padding: 16px 32px;
  }

  .warning-text {
    color: #dc3545;
    font-size: 14px;
    font-weight: 500;
  }

  .response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .response-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.3rem;
  }

  .response-data {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 20px;
    border-radius: 12px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
    line-height: 1.6;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 600px;
    overflow-y: auto;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #6c757d;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: 20px;
      text-align: center;
    }

    .section-header {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
      gap: 12px;
    }

    .search-input {
      width: 100%;
    }

    .endpoints-grid {
      grid-template-columns: 1fr;
    }

    .testing-section {
      grid-template-columns: 1fr;
    }

    .scopes-grid {
      grid-template-columns: 1fr;
    }
  }
</style>