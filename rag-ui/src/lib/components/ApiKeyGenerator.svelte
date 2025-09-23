<!-- API Key Generator Component for Testing -->
<script lang="ts">
  import { ApiAuth } from '$lib/api-auth.js';

  let keyName = '';
  let selectedScopes: string[] = [];
  let generatedKey = '';
  let showGenerator = false;

  const availableScopes = [
    { id: 'files:read', label: 'Read Files', description: 'List and view user files' },
    { id: 'files:write', label: 'Write Files', description: 'Upload and modify files' },
    { id: 'files:delete', label: 'Delete Files', description: 'Delete user files' },
    { id: 'corpus:read', label: 'Read Corpus', description: 'View corpus information' },
    { id: 'corpus:write', label: 'Write Corpus', description: 'Manage corpus operations' },
    { id: 'rag:query', label: 'RAG Query', description: 'Query the RAG system' },
    { id: 'rag:import', label: 'RAG Import', description: 'Import files to RAG' },
    { id: 'system:status', label: 'System Status', description: 'View system status' },
    { id: 'admin', label: 'Admin Access', description: 'Full administrative access' }
  ];

  function toggleScope(scopeId: string) {
    if (selectedScopes.includes(scopeId)) {
      selectedScopes = selectedScopes.filter(s => s !== scopeId);
    } else {
      selectedScopes = [...selectedScopes, scopeId];
    }
  }

  function generateApiKey() {
    if (!keyName || selectedScopes.length === 0) return;

    try {
      const apiKey = ApiAuth.generateApiKey('test-user@example.com', keyName, selectedScopes as any);
      generatedKey = apiKey.key;
    } catch (error) {
      console.error('Failed to generate API key:', error);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedKey);
  }

  function reset() {
    keyName = '';
    selectedScopes = [];
    generatedKey = '';
  }
</script>

<div class="api-key-generator">
  <button class="toggle-btn" on:click={() => showGenerator = !showGenerator}>
    {showGenerator ? '🔽' : '▶️'} Generate Test API Key
  </button>

  {#if showGenerator}
    <div class="generator-content">
      <div class="form-group">
        <label for="key-name">API Key Name:</label>
        <input
          type="text"
          id="key-name"
          bind:value={keyName}
          placeholder="e.g., My Test Key"
          class="key-name-input"
        />
      </div>

      <div class="form-group">
        <fieldset>
          <legend>Scopes (select at least one):</legend>
          <div class="scopes-grid">
          {#each availableScopes as scope}
            <div class="scope-item">
              <label class="scope-label">
                <input
                  type="checkbox"
                  value={scope.id}
                  checked={selectedScopes.includes(scope.id)}
                  on:change={() => toggleScope(scope.id)}
                />
                <span class="scope-name">{scope.label}</span>
                <span class="scope-description">{scope.description}</span>
              </label>
            </div>
          {/each}
          </div>
        </fieldset>
      </div>

      <div class="form-actions">
        <button
          class="generate-btn"
          on:click={generateApiKey}
          disabled={!keyName || selectedScopes.length === 0}
        >
          🔑 Generate API Key
        </button>
        <button class="reset-btn" on:click={reset}>
          🔄 Reset
        </button>
      </div>

      {#if generatedKey}
        <div class="generated-key">
          <h4>🎉 API Key Generated!</h4>
          <div class="key-display">
            <code class="api-key">{generatedKey}</code>
            <button class="copy-btn" on:click={copyToClipboard}>
              📋 Copy
            </button>
          </div>
          <div class="key-info">
            <p><strong>⚠️ Important:</strong> Save this key securely. It won't be shown again!</p>
            <p><strong>Usage:</strong> Include in Authorization header as <code>Bearer {generatedKey}</code></p>
            <p><strong>Scopes:</strong> {selectedScopes.join(', ')}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .api-key-generator {
    background: #f8f9fa;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: #667eea;
    font-weight: 600;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .generator-content {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e1e5e9;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #2c3e50;
  }

  .form-group fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }

  .form-group legend {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 8px;
    padding: 0;
  }

  .key-name-input {
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .key-name-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .scopes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }

  .scope-item {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    padding: 12px;
    transition: all 0.2s;
  }

  .scope-item:hover {
    border-color: #667eea;
    background: #f8f9ff;
  }

  .scope-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    margin: 0;
  }

  .scope-label input {
    margin-right: 8px;
    align-self: flex-start;
  }

  .scope-name {
    font-weight: 600;
    color: #2c3e50;
    font-size: 14px;
  }

  .scope-description {
    font-size: 12px;
    color: #666;
    opacity: 0.8;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin: 20px 0;
  }

  .generate-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .reset-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .generated-key {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .generated-key h4 {
    margin: 0 0 15px 0;
    color: #155724;
  }

  .key-display {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }

  .api-key {
    flex: 1;
    background: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    border: 1px solid #c3e6cb;
  }

  .copy-btn {
    background: #155724;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }

  .key-info {
    font-size: 14px;
    color: #155724;
  }

  .key-info p {
    margin: 5px 0;
  }

  .key-info code {
    background: rgba(21, 87, 36, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  @media (max-width: 768px) {
    .scopes-grid {
      grid-template-columns: 1fr;
    }

    .key-display {
      flex-direction: column;
    }

    .api-key {
      font-size: 10px;
    }
  }
</style>