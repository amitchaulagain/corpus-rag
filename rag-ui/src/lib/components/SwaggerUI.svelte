<!-- Custom Swagger-like API Documentation and Testing UI -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { openApiSpec } from '../openapi-spec.js';
  import ApiKeyGenerator from './ApiKeyGenerator.svelte';

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
  let activeTab = $state('docs'); // 'docs' or 'test'

  interface EndpointInfo {
    path: string;
    method: string;
    summary: string;
    description: string;
    tags: string[];
    parameters?: any[];
    requestBody?: any;
    responses: any;
  }

  let endpoints: EndpointInfo[] = [];

  onMount(() => {
    // Parse OpenAPI spec to extract endpoints
    endpoints = Object.entries(openApiSpec.paths).flatMap(([path, pathObj]) =>
      Object.entries(pathObj as any).map(([method, methodObj]: [string, any]) => ({
        path,
        method: method.toUpperCase(),
        summary: methodObj.summary || '',
        description: methodObj.description || '',
        tags: methodObj.tags || [],
        parameters: methodObj.parameters || [],
        requestBody: methodObj.requestBody,
        responses: methodObj.responses
      }))
    );
  });

  function selectEndpoint(endpoint: EndpointInfo) {
    selectedEndpoint = endpoint.path;
    selectedMethod = endpoint.method;

    // Set default request body if available
    if (endpoint.requestBody?.content?.['application/json']?.schema) {
      requestBody = JSON.stringify(getExampleFromSchema(endpoint.requestBody.content['application/json'].schema), null, 2);
    } else if (endpoint.requestBody?.content?.['multipart/form-data']) {
      requestBody = '// Use form data for file upload\n// FormData will be created automatically';
    } else {
      requestBody = '';
    }

    responseData = '';
    activeTab = 'test';
  }

  function getExampleFromSchema(schema: any): any {
    if (schema.$ref) {
      // Handle schema references
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const refSchema = openApiSpec.components.schemas[refPath];
      return getExampleFromSchema(refSchema);
    }

    if (schema.type === 'object') {
      const example: any = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
          if (schema.required?.includes(key) || Math.random() > 0.5) {
            example[key] = getExampleFromSchema(prop);
          }
        });
      }
      return example;
    }

    if (schema.type === 'array') {
      return [getExampleFromSchema(schema.items)];
    }

    if (schema.type === 'string') {
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'email') return 'user@example.com';
      if (schema.enum) return schema.enum[0];
      return schema.example || 'string';
    }

    if (schema.type === 'integer' || schema.type === 'number') {
      return schema.example || (schema.default !== undefined ? schema.default : 42);
    }

    if (schema.type === 'boolean') {
      return schema.example || (schema.default !== undefined ? schema.default : true);
    }

    return null;
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

      // Handle request body
      if (requestBody && selectedMethod !== 'GET') {
        if (selectedEndpoint === '/files' && selectedMethod === 'POST') {
          // Special handling for file upload
          const formData = new FormData();
          formData.append('userId', userId);

          // Create a sample file for testing
          const testFile = new File(['Sample file content'], 'test.txt', { type: 'text/plain' });
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

  function getEndpointsByTag(tag: string) {
    return endpoints.filter(ep => ep.tags.includes(tag));
  }

  const tags = [...new Set(endpoints.flatMap(ep => ep.tags))];
</script>

<div class="swagger-ui">
  <div class="header">
    <h1>🚀 RAG System API Documentation</h1>
    <p>Interactive API documentation and testing interface</p>
  </div>

  <div class="nav-tabs">
    <button
      class="tab-btn"
      class:active={activeTab === 'docs'}
      onclick={() => activeTab = 'docs'}
    >
      📖 Documentation
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'test'}
      onclick={() => activeTab = 'test'}
    >
      🧪 API Tester
    </button>
  </div>

  {#if activeTab === 'docs'}
    <div class="docs-section">
      <div class="api-info">
        <h2>API Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <strong>Version:</strong> {openApiSpec.info.version}
          </div>
          <div class="info-item">
            <strong>Base URL:</strong> /api
          </div>
          <div class="info-item">
            <strong>Authentication:</strong> Bearer Token (API Key)
          </div>
        </div>
      </div>

      {#each tags as tag}
        <div class="tag-section">
          <h3>{tag}</h3>
          <div class="endpoints">
            {#each getEndpointsByTag(tag) as endpoint}
              <div class="endpoint-card">
                <button
                  class="endpoint-header"
                  onclick={() => selectEndpoint(endpoint)}
                  type="button"
                  aria-label="Test endpoint {endpoint.method} {endpoint.path}"
                >
                  <span class="method method-{endpoint.method.toLowerCase()}">{endpoint.method}</span>
                  <span class="path">{endpoint.path}</span>
                  <span class="summary">{endpoint.summary}</span>
                  <span class="test-btn">Try it</span>
                </button>
                <div class="endpoint-description">
                  {endpoint.description}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if activeTab === 'test'}
    <div class="test-section">
      <ApiKeyGenerator />

      <div class="api-key-section">
        <label for="api-key">API Key for Testing:</label>
        <input
          type="password"
          id="api-key"
          bind:value={apiKey}
          placeholder="rag_[keyId]_[secret]"
          class="api-key-input"
        />
        <small>Use the API key generator above or paste an existing API key</small>
      </div>

      {#if selectedEndpoint}
        <div class="selected-endpoint">
          <h3>
            <span class="method method-{selectedMethod.toLowerCase()}">{selectedMethod}</span>
            {selectedEndpoint}
          </h3>

          {#if requestBody}
            <div class="request-section">
              <label for="request-body">Request Body:</label>
              <textarea
                id="request-body"
                bind:value={requestBody}
                rows="10"
                class="json-editor"
                placeholder="Enter JSON request body..."
              ></textarea>
            </div>
          {/if}

          <div class="action-section">
            <button
              class="execute-btn"
              onclick={testEndpoint}
              disabled={isLoading}
            >
              {isLoading ? '⏳ Executing...' : '▶️ Execute'}
            </button>
          </div>

          {#if responseData}
            <div class="response-section">
              <h4>Response:</h4>
              <pre class="response-data">{responseData}</pre>
            </div>
          {/if}
        </div>
      {:else}
        <div class="no-endpoint">
          <p>👈 Select an endpoint from the Documentation tab to test it</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .swagger-ui {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
    padding: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
  }

  .header h1 {
    margin: 0 0 10px 0;
    font-size: 2.5rem;
  }

  .header p {
    margin: 0;
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .nav-tabs {
    display: flex;
    gap: 5px;
    margin-bottom: 30px;
    border-bottom: 2px solid #e1e5e9;
  }

  .tab-btn {
    padding: 15px 25px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
  }

  .tab-btn:hover {
    color: #2c3e50;
    background: #f8f9fa;
  }

  .tab-btn.active {
    color: #2c3e50;
    border-bottom-color: #667eea;
    background: #f8f9fa;
  }

  .api-info {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 30px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 15px;
  }

  .info-item {
    font-size: 14px;
  }

  .tag-section {
    margin-bottom: 40px;
  }

  .tag-section h3 {
    color: #2c3e50;
    font-size: 1.5rem;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e1e5e9;
  }

  .endpoints {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .endpoint-card {
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.2s;
  }

  .endpoint-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .endpoint-header {
    display: flex;
    align-items: center;
    padding: 15px 20px;
    background: white;
    cursor: pointer;
    gap: 15px;
    border: none;
    width: 100%;
    text-align: left;
    font-size: inherit;
    font-family: inherit;
  }

  .endpoint-header:hover {
    background: #f8f9fa;
  }

  .endpoint-header:focus {
    outline: 2px solid #667eea;
    outline-offset: -2px;
  }

  .method {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    min-width: 60px;
    text-align: center;
  }

  .method-get { background: #e7f3ff; color: #0969da; }
  .method-post { background: #e6ffed; color: #1a7f37; }
  .method-put { background: #fff8e1; color: #9a6700; }
  .method-delete { background: #ffebe9; color: #cf222e; }

  .path {
    font-family: monospace;
    color: #666;
    flex: 1;
  }

  .summary {
    color: #2c3e50;
    font-weight: 500;
  }

  .test-btn {
    background: #667eea;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    transition: background 0.2s;
  }

  .endpoint-header:hover .test-btn {
    background: #5a6fd8;
  }

  .endpoint-description {
    padding: 15px 20px;
    background: #f8f9fa;
    color: #666;
    font-size: 14px;
    border-top: 1px solid #e1e5e9;
  }

  .api-key-section {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
  }

  .api-key-section label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #856404;
  }

  .api-key-input {
    width: 100%;
    padding: 10px;
    border: 2px solid #ffeaa7;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
  }

  .api-key-section small {
    display: block;
    margin-top: 8px;
    color: #856404;
    opacity: 0.8;
  }

  .selected-endpoint {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
  }

  .selected-endpoint h3 {
    margin: 0 0 20px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .request-section {
    margin-bottom: 20px;
  }

  .request-section label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #2c3e50;
  }

  .json-editor {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.4;
    resize: vertical;
  }

  .json-editor:focus {
    outline: none;
    border-color: #667eea;
  }

  .action-section {
    margin-bottom: 20px;
  }

  .execute-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .execute-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .execute-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .response-section h4 {
    margin: 0 0 10px 0;
    color: #2c3e50;
  }

  .response-data {
    background: #1a1a1a;
    color: #e0e0e0;
    padding: 15px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .no-endpoint {
    text-align: center;
    padding: 60px 20px;
    color: #666;
    background: #f8f9fa;
    border-radius: 8px;
    border: 2px dashed #ddd;
  }

  @media (max-width: 768px) {
    .endpoint-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .path {
      word-break: break-all;
    }

    .nav-tabs {
      flex-direction: column;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>