<!-- API Key Generator Component for Testing -->
<script lang="ts">
  let keyName = $state('');
  let selectedScopes: string[] = $state([]);
  let generatedKey = $state('');
  let showGenerator = $state(false);
  let errorMessage = $state('');
  let isGenerating = $state(false);

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

  interface Props {
    userId?: string;
  }

  let { userId = '' }: Props = $props();

  async function generateApiKey() {
    if (!keyName || selectedScopes.length === 0 || !userId) return;

    isGenerating = true;
    errorMessage = '';

    try {
      // Get session token for authentication
      const token = localStorage.getItem('session_token');
      if (!token) {
        throw new Error('No session token found. Please log in again.');
      }

      // Call the API endpoint to generate key
      const response = await fetch('/api/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: keyName,
          scopes: selectedScopes
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate API key' }));
        throw new Error(error.error || 'Failed to generate API key');
      }

      const data = await response.json();
      if (data.success && data.data.apiKey) {
        generatedKey = data.data.apiKey;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to generate API key';
    } finally {
      isGenerating = false;
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedKey);
  }

  function reset() {
    keyName = '';
    selectedScopes = [];
    generatedKey = '';
    errorMessage = '';
  }
</script>

<div class="api-key-generator">
  <button class="toggle-btn" onclick={() => showGenerator = !showGenerator}>
    {showGenerator ? '🔽' : '▶️'} Generate Test API Key
  </button>

  {#if showGenerator}
    <div class="generator-content">
      {#if errorMessage}
        <div class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <div class="form-group">
        <label for="key-name">API Key Name:</label>
        <input
          type="text"
          id="key-name"
          bind:value={keyName}
          placeholder="e.g., My Test Key"
          class="key-name-input"
          disabled={isGenerating}
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
                  onchange={() => toggleScope(scope.id)}
                  disabled={isGenerating}
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
          onclick={generateApiKey}
          disabled={!keyName || selectedScopes.length === 0 || isGenerating}
        >
          {#if isGenerating}
            <span class="loading loading-spinner loading-sm"></span> Generating...
          {:else}
            🔑 Generate API Key
          {/if}
        </button>
        <button class="reset-btn" onclick={reset} disabled={isGenerating}>
          🔄 Reset
        </button>
      </div>

      {#if generatedKey}
        <div class="generated-key">
          <h4>🎉 API Key Generated!</h4>
          <div class="key-display">
            <code class="api-key">{generatedKey}</code>
            <button class="copy-btn" onclick={copyToClipboard}>
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
    background: oklch(var(--b2));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: oklch(var(--p));
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
    border-top: 1px solid oklch(var(--bc) / 0.2);
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: oklch(var(--bc));
  }

  .form-group fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }

  .form-group legend {
    font-weight: 600;
    color: oklch(var(--bc));
    margin-bottom: 8px;
    padding: 0;
  }

  .key-name-input {
    width: 100%;
    padding: 10px;
    border: 2px solid oklch(var(--bc) / 0.2);
    border-radius: 4px;
    font-size: 14px;
    background: oklch(var(--b1));
    color: oklch(var(--bc));
  }

  .key-name-input:focus {
    outline: none;
    border-color: oklch(var(--p));
  }

  .scopes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }

  .scope-item {
    background: oklch(var(--b1));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 6px;
    padding: 12px;
    transition: all 0.2s;
  }

  .scope-item:hover {
    border-color: oklch(var(--p));
    background: oklch(var(--b3));
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
    color: oklch(var(--bc));
    font-size: 14px;
  }

  .scope-description {
    font-size: 12px;
    color: oklch(var(--bc) / 0.7);
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
    background: oklch(var(--su) / 0.1);
    border: 1px solid oklch(var(--su) / 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .generated-key h4 {
    margin: 0 0 15px 0;
    color: oklch(var(--suc));
  }

  .key-display {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }

  .api-key {
    flex: 1;
    background: oklch(var(--b1));
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    border: 1px solid oklch(var(--su) / 0.3);
    color: oklch(var(--bc));
  }

  .copy-btn {
    background: oklch(var(--su));
    color: oklch(var(--suc));
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }

  .key-info {
    font-size: 14px;
    color: oklch(var(--bc));
  }

  .key-info p {
    margin: 5px 0;
  }

  .key-info code {
    background: oklch(var(--bc) / 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
    color: oklch(var(--bc));
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