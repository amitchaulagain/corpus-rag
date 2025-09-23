<!-- Sleek API Tester Component for Main UI -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { openApiSpec } from '../openapi-spec.js';
  import { ApiAuth } from '../api-auth.js';

  interface Props {
    userId?: string;
  }

  let { userId = '' }: Props = $props();

  let apiKey = $state('');
  let selectedEndpoint = $state('');
  let selectedMethod = $state('');
  let requestBody = $state('');
  let responseData = $state('');
  let isLoading = $state(false);
  let isGeneratingKey = $state(false);
  let requestBodyError = $state('');
  let requestBodyValid = $state(false);
  let currentEndpoint: EndpointInfo | null = $state(null);
  let editableUrl = $state('');
  let selectedFile: File | null = $state(null);
  let availableFiles: string[] = $state([]);
  let isLoadingFiles = $state(false);

  // API Key Generation
  let keyName = $state('Test API Key');
  let selectedScopes: string[] = $state(['files:read', 'files:write', 'rag:query']);
  let showKeyGenerator = $state(false);

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

  let endpoints: EndpointInfo[] = $state([]);
  let filteredEndpoints: EndpointInfo[] = $state([]);
  let searchTerm = $state('');
  let selectedTag = $state('All');

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
    if (!userId) {
      console.warn('No userId provided for test credentials');
      return;
    }
    
    try {
      const response = await fetch(`/api/auth/test-key?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.success) {
        apiKey = data.data.apiKey;
        console.log(`🔑 Auto-loaded test API key for user: ${data.data.testUserId}`);
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
    currentEndpoint = endpoint;
    editableUrl = `/api${endpoint.path}`;

    // Load files if this is a delete operation
    if (endpoint.method === 'DELETE' && endpoint.path.includes('/files/')) {
      loadAvailableFiles();
    }

    // Reset file selection
    selectedFile = null;

    // Generate detailed request body based on OpenAPI spec
    if (endpoint.method !== 'GET') {
      requestBody = generateRequestBodyTemplate(endpoint);
      validateRequestBody();
    } else {
      requestBody = '';
      requestBodyError = '';
      requestBodyValid = false;
    }

    responseData = '';
  }

  function generateRequestBodyTemplate(endpoint: EndpointInfo): string {
    const templates: { [key: string]: any } = {
      '/rag/query': {
        userId: userId,
        question: "What are my key skills and experience?",
        context: null,
        maxResults: 5
      },
      '/rag/import': {
        userId: userId,
        cloudStorageUris: [`gs://rag-storage-439974099982/users/${userId}/resume.pdf`],
        waitForCompletion: false
      },
      '/corpus': {
        userId: userId,
        action: "get_or_create"
      },
      '/files': {
        // Note: This is for multipart/form-data, shown as reference
        userId: userId,
        replaceExisting: false,
        // file: "Upload via form data"
      },
      '/auth/keys': {
        userId: userId,
        name: "My Test API Key",
        scopes: ["files:read", "files:write", "rag:query", "rag:import"]
      },
      '/system/stats': {
        userId: userId
      }
    };

    // Find matching template
    for (const [path, template] of Object.entries(templates)) {
      if (endpoint.path.includes(path)) {
        return JSON.stringify(template, null, 2);
      }
    }

    // Default template
    return JSON.stringify({
      userId: userId,
      // Add common fields based on endpoint
      ...(endpoint.path.includes('delete') ? { confirm: true } : {}),
      ...(endpoint.path.includes('create') ? { name: "Example Name" } : {}),
    }, null, 2);
  }

  async function generateApiKey() {
    if (!keyName || selectedScopes.length === 0 || !userId) return;

    isGeneratingKey = true;
    try {
      const generatedKey = await ApiAuth.generateApiKey(userId, keyName, selectedScopes as any);
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
      const url = editableUrl || `/api${selectedEndpoint}`;
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
          // Handle file upload
          const formData = new FormData();
          
          if (selectedFile) {
            formData.append('file', selectedFile);
          } else {
            // Create a test file if none selected
            const testFile = new File(['Sample test content'], 'test.txt', { type: 'text/plain' });
            formData.append('file', testFile);
          }
          
          if (userId) formData.append('userId', userId);
          
          // Parse additional form data from request body
          try {
            const bodyData = JSON.parse(requestBody);
            Object.entries(bodyData).forEach(([key, value]) => {
              if (key !== 'file' && value !== null && value !== undefined) {
                formData.append(key, String(value));
              }
            });
          } catch (e) {
            // Ignore JSON parsing errors for form data
          }
          
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

  async function loadTestApiKey() {
    if (!userId) {
      alert('Please authenticate first to load API key');
      return;
    }

    try {
      const response = await fetch(`/api/auth/test-key?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.success) {
        apiKey = data.data.apiKey;
        console.log(`🔑 Test API key loaded for user: ${data.data.testUserId}`);
      } else {
        alert('Failed to load test API key: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to load test API key:', error);
      alert('Failed to load test API key');
    }
  }

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey);
  }

  function copyResponse() {
    navigator.clipboard.writeText(responseData);
  }

  function formatRequestBody() {
    try {
      const parsed = JSON.parse(requestBody);
      requestBody = JSON.stringify(parsed, null, 2);
      requestBodyError = '';
      requestBodyValid = true;
    } catch (error) {
      requestBodyError = 'Invalid JSON format';
      requestBodyValid = false;
    }
  }

  function validateRequestBody() {
    if (!requestBody.trim()) {
      requestBodyError = '';
      requestBodyValid = false;
      return;
    }

    try {
      JSON.parse(requestBody);
      requestBodyError = '';
      requestBodyValid = true;
    } catch (error) {
      requestBodyError = 'Invalid JSON: ' + (error as Error).message;
      requestBodyValid = false;
    }
  }

  function resetRequestBody() {
    if (currentEndpoint) {
      requestBody = generateRequestBodyTemplate(currentEndpoint);
      validateRequestBody();
    }
  }

  function getExpectedSchema(): string {
    if (!currentEndpoint) return 'No endpoint selected';

    const schemas: { [key: string]: any } = {
      '/rag/query': {
        userId: 'string (required)',
        question: 'string (required)',
        context: 'string | null (optional)',
        maxResults: 'number (optional, default: 5)'
      },
      '/rag/import': {
        userId: 'string (required)',
        cloudStorageUris: 'string[] (required)',
        waitForCompletion: 'boolean (optional, default: false)'
      },
      '/corpus': {
        userId: 'string (required)',
        action: 'string (required): "get_or_create" | "cleanup"'
      },
      '/auth/keys': {
        userId: 'string (required)',
        name: 'string (required)',
        scopes: 'string[] (required)'
      },
      '/system/stats': {
        userId: 'string (required)'
      },
      '/files': {
        file: 'File (required for upload)',
        userId: 'string (optional)',
        replaceExisting: 'boolean (optional, default: false)'
      }
    };

    for (const [path, schema] of Object.entries(schemas)) {
      if (currentEndpoint.path.includes(path)) {
        return JSON.stringify(schema, null, 2);
      }
    }

    return JSON.stringify({
      userId: 'string (required)',
      '...': 'additional fields based on endpoint'
    }, null, 2);
  }

  async function loadAvailableFiles() {
    if (!userId) return;
    
    isLoadingFiles = true;
    try {
      const response = await fetch(`/api/files?userId=${encodeURIComponent(userId)}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.files) {
          availableFiles = data.data.files.map((file: any) => file.name || file.filename);
        }
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      isLoadingFiles = false;
    }
  }

  function selectFileForDeletion(filename: string) {
    editableUrl = `/api/files/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId)}`;
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0];
    }
  }

  let tags = $derived(['All', ...new Set(endpoints.flatMap(ep => ep.tags))]);
  
  $effect(() => {
    // Re-run filtering when search term or selected tag changes
    filterEndpoints();
  });

  $effect(() => {
    // Validate request body when it changes
    if (requestBody) {
      validateRequestBody();
    }
  });
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
        onclick={() => showKeyGenerator = !showKeyGenerator}
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
          onclick={generateApiKey}
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
        <button class="load-btn" onclick={loadTestApiKey} title="Load Test API Key">🔑 Load</button>
        {#if apiKey}
          <button class="copy-btn" onclick={copyApiKey} title="Copy API Key">📋</button>
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
          onclick={() => selectEndpoint(endpoint)}
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
          <input 
            type="text" 
            bind:value={editableUrl}
            class="endpoint-url-input"
            placeholder="/api/endpoint"
          />
        </div>

        {#if requestBody}
          <div class="body-section">
            <div class="body-header">
              <label class="field-label">Request Body:</label>
              <div class="body-actions">
                <button 
                  class="btn-small" 
                  onclick={() => formatRequestBody()}
                  title="Format JSON"
                >
                  🎨 Format
                </button>
                <button 
                  class="btn-small" 
                  onclick={() => validateRequestBody()}
                  title="Validate JSON"
                >
                  ✅ Validate
                </button>
                <button 
                  class="btn-small" 
                  onclick={() => resetRequestBody()}
                  title="Reset to template"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
            <textarea
              bind:value={requestBody}
              class="json-editor"
              rows="12"
              placeholder="Enter JSON request body..."
            ></textarea>
            {#if requestBodyError}
              <div class="error-message">
                ❌ {requestBodyError}
              </div>
            {/if}
            {#if requestBodyValid}
              <div class="success-message">
                ✅ Valid JSON
              </div>
            {/if}
            <div class="body-info">
              <details class="schema-details">
                <summary>📋 Expected Schema</summary>
                <pre class="schema-display">{getExpectedSchema()}</pre>
              </details>
            </div>
          </div>
        {/if}

        {#if selectedMethod === 'POST' && selectedEndpoint.includes('/files')}
          <div class="file-section">
            <div class="file-header">
              <label class="field-label">File Upload:</label>
            </div>
            <div class="file-input-container">
              <input 
                type="file" 
                onchange={handleFileSelect}
                class="file-input"
                accept="*/*"
              />
              {#if selectedFile}
                <div class="selected-file-info">
                  <span class="file-name">📄 {selectedFile.name}</span>
                  <span class="file-size">({Math.round(selectedFile.size / 1024)} KB)</span>
                  <button class="btn-small" onclick={() => selectedFile = null}>❌ Remove</button>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedMethod === 'DELETE' && selectedEndpoint.includes('/files/')}
          <div class="file-list-section">
            <div class="file-list-header">
              <label class="field-label">Select File to Delete:</label>
              <button 
                class="btn-small" 
                onclick={loadAvailableFiles}
                disabled={isLoadingFiles}
              >
                {isLoadingFiles ? '⏳ Loading...' : '🔄 Refresh'}
              </button>
            </div>
            <div class="file-list">
              {#if isLoadingFiles}
                <div class="loading-message">Loading files...</div>
              {:else if availableFiles.length === 0}
                <div class="empty-message">No files found</div>
              {:else}
                {#each availableFiles as filename}
                  <button 
                    class="file-item"
                    onclick={() => selectFileForDeletion(filename)}
                    class:selected={editableUrl.includes(filename)}
                  >
                    📄 {filename}
                  </button>
                {/each}
              {/if}
            </div>
          </div>
        {/if}

        <div class="action-section">
          <button
            class="btn-primary execute-btn"
            onclick={testEndpoint}
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
            <button class="copy-btn" onclick={copyResponse} title="Copy Response">📋</button>
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

  .load-btn {
    position: absolute;
    right: 60px;
    padding: 4px 8px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  }

  .load-btn:hover {
    background: #218838;
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

  .body-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .body-actions {
    display: flex;
    gap: 8px;
  }

  .btn-small {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f8f9fa;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-small:hover {
    background: #e9ecef;
    border-color: #adb5bd;
  }

  .error-message {
    color: #dc3545;
    font-size: 12px;
    margin-top: 4px;
    padding: 8px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
  }

  .success-message {
    color: #28a745;
    font-size: 12px;
    margin-top: 4px;
    padding: 8px;
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 4px;
  }

  .body-info {
    margin-top: 12px;
  }

  .schema-details {
    border: 1px solid #e9ecef;
    border-radius: 4px;
    background: #f8f9fa;
  }

  .schema-details summary {
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 500;
    background: #e9ecef;
    border-radius: 4px 4px 0 0;
  }

  .schema-details[open] summary {
    border-bottom: 1px solid #dee2e6;
    border-radius: 4px 4px 0 0;
  }

  .schema-display {
    margin: 0;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    background: #ffffff;
    border: none;
    white-space: pre-wrap;
    color: #495057;
  }

  .endpoint-url-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    background: #f8f9fa;
    margin-left: 8px;
  }

  .endpoint-url-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  .file-section,
  .file-list-section {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    background: #f8f9fa;
  }

  .file-header,
  .file-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .file-input-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .file-input {
    padding: 8px;
    border: 2px dashed #ddd;
    border-radius: 8px;
    background: white;
    cursor: pointer;
  }

  .file-input:hover {
    border-color: #667eea;
    background: #f0f4ff;
  }

  .selected-file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #e7f3ff;
    border: 1px solid #b3d9ff;
    border-radius: 4px;
  }

  .file-name {
    font-weight: 500;
    color: #0066cc;
  }

  .file-size {
    color: #666;
    font-size: 12px;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .file-item:hover {
    background: #f0f4ff;
    border-color: #667eea;
  }

  .file-item.selected {
    background: #667eea;
    color: white;
    border-color: #5a6fd8;
  }

  .loading-message,
  .empty-message {
    text-align: center;
    padding: 16px;
    color: #666;
    font-style: italic;
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