<script lang="ts">
  import { onMount } from 'svelte';

  let isAuthenticated = false;
  let user: any = null;
  let question = '';
  let comparisonResults: any = null;
  let isLoading = false;
  let providers: any[] = [];
  let uploadedFiles: any[] = [];
  let attachFile = true;
  let selectedFile: string = '';

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;
    }

    // Load available providers
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      if (data.success) {
        providers = data.providers.filter((p: any) => p.enabled && p.hasApiKey);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }

    // Load uploaded files
    if (user) {
      await loadFiles();
    }
  });

  async function loadFiles() {
    try {
      const response = await fetch(`/api/upload?userId=${user.email}`);
      const data = await response.json();
      if (data.success && data.files.length > 0) {
        uploadedFiles = data.files;
        selectedFile = data.files[0].name; // Auto-select first file
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }

  async function handleCompare(event: Event) {
    event.preventDefault();

    if (!question.trim() || !user) return;

    isLoading = true;
    comparisonResults = null;

    try {
      let finalQuestion = question.trim();

      // Attach file content if enabled
      if (attachFile && selectedFile) {
        const fileResponse = await fetch(`/api/upload?userId=${user.email}&filename=${selectedFile}`);
        const fileData = await fileResponse.json();
        if (fileData.success && fileData.content) {
          finalQuestion = `Context from ${selectedFile}:\n\n${fileData.content}\n\n---\n\nQuestion: ${finalQuestion}`;
        }
      }

      const response = await fetch('/api/query/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
          question: finalQuestion
        })
      });

      const data = await response.json();

      if (data.success) {
        comparisonResults = data.results;
      } else {
        alert(`Error: ${data.error || 'Query failed'}`);
      }
    } catch (error) {
      console.error('Query failed:', error);
      alert(`Error: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  function formatTime(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  function formatCurrency(value: number, currency: string): string {
    if (value === 0 && currency === 'USD') return 'FREE';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      }).format(value);
    } catch (e) {
      // Fallback for invalid currency codes
      return `${currency} ${value.toFixed(4)}`;
    }
  }

  function getProviderName(id: string): string {
    const provider = providers.find((p) => p.id === id);
    return provider?.name || id;
  }

  function getProviderIcon(id: string): string {
    if (id.includes('claude')) return '🟣';
    if (id.includes('deepseek')) return '🔵';
    if (id.includes('gemini')) return '🟢';
    return '🤖';
  }
</script>

{#if isAuthenticated && user}
  <main class="container mx-auto max-w-7xl p-6">
    <header class="mb-8">
      <h1 class="text-4xl font-bold mb-4 text-primary">🔍 AI Comparison</h1>
      <p class="text-base-content/70">Compare responses from multiple AI providers</p>
    </header>

    <!-- Search Form -->
    <div class="card bg-base-100 shadow-xl mb-8">
      <div class="card-body">
        <form on:submit={handleCompare}>
          <div class="flex gap-3 mb-4">
            <input
              type="text"
              bind:value={question}
              placeholder="Ask a question about your documents..."
              class="input input-bordered flex-1 text-lg"
              class:input-disabled={isLoading}
              disabled={isLoading}
            />
            <button
              type="submit"
              class="btn btn-primary btn-lg"
              class:btn-disabled={isLoading || !question.trim() || providers.length === 0}
              disabled={isLoading || !question.trim() || providers.length === 0}
            >
              {#if isLoading}
                <span class="loading loading-spinner"></span>
                Comparing...
              {:else}
                Compare All AIs
              {/if}
            </button>
          </div>

          <!-- File Attachment Toggle -->
          {#if uploadedFiles.length > 0}
            <div class="flex items-center gap-4 mb-4 p-3 bg-base-200 rounded-lg">
              <div class="form-control">
                <label class="label cursor-pointer gap-2">
                  <input type="checkbox" bind:checked={attachFile} class="toggle toggle-primary" />
                  <span class="label-text font-semibold">Auto-attach file context</span>
                </label>
              </div>
              {#if attachFile}
                <select bind:value={selectedFile} class="select select-bordered select-sm">
                  {#each uploadedFiles as file}
                    <option value={file.name}>{file.name}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {:else}
            <div class="alert alert-info mb-4">
              <span>📄 No files uploaded. <a href="/upload" class="link">Upload a .txt file</a> to provide context.</span>
            </div>
          {/if}

          {#if providers.length === 0}
            <div class="alert alert-warning">
              <span>⚠️ No AI providers configured. Please configure providers in <code>/src/config/providers.json</code></span>
            </div>
          {:else}
            <div class="text-sm opacity-70">
              Active providers: {providers.map((p) => p.name).join(', ')}
            </div>
          {/if}
        </form>
      </div>
    </div>

    <!-- Loading State -->
    {#if isLoading}
      <div class="flex flex-col items-center py-16">
        <span class="loading loading-spinner loading-lg text-primary mb-4"></span>
        <p class="text-lg font-semibold">Querying all AI providers...</p>
        <p class="text-base-content/70">This may take a few seconds</p>
      </div>
    {/if}

    <!-- Comparison Results -->
    {#if comparisonResults && !isLoading}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each Object.entries(comparisonResults) as [providerId, result]}
          <div class="card bg-base-100 shadow-xl border-2 {result.success ? 'border-success' : 'border-error'}">
            <div class="card-body">
              <!-- Provider Header -->
              <div class="flex items-center justify-between mb-4">
                <h3 class="card-title text-lg">
                  {getProviderIcon(providerId)} {getProviderName(providerId)}
                </h3>
                {#if result.success}
                  <span class="badge badge-success">Success</span>
                {:else}
                  <span class="badge badge-error">Failed</span>
                {/if}
              </div>

              <!-- Answer -->
              {#if result.success && result.answer}
                <div class="prose prose-sm max-w-none mb-4">
                  <div class="whitespace-pre-wrap leading-relaxed text-base-content">
                    {result.answer}
                  </div>
                </div>
              {:else if result.error}
                {@const isClaudeBillingError = providerId.includes('claude') && result.error.includes('credit balance is too low')}
                {#if isClaudeBillingError}
                  <div class="alert alert-warning mb-4">
                    <div class="text-sm">
                      <span>
                        The Claude API requires a paid balance. Please visit
                        <a href="https://console.anthropic.com/settings/billing" target="_blank" class="link">
                          Anthropic's billing page
                        </a>, pay $5 USD plus taxes, and get an API key.
                      </span>
                    </div>
                  </div>
                {:else}
                  <div class="alert alert-error mb-4">
                    <span class="text-sm">{result.error}</span>
                  </div>
                {/if}
              {/if}

              <!-- Metadata -->
              <div class="divider my-2"></div>
              <div class="text-xs opacity-70 space-y-1">
                {#if result.metadata}
                  <div class="flex justify-between">
                    <span>⏱️ Time:</span>
                    <span class="font-semibold">{formatTime(result.metadata.processingTime)}</span>
                  </div>
                  {#if result.metadata.tokensUsed}
                    <div class="flex justify-between">
                      <span>🎯 Tokens:</span>
                      <span class="font-semibold">{result.metadata.tokensUsed?.toLocaleString()}</span>
                    </div>
                  {/if}
                  <div class="flex justify-between">
                    <span>🤖 Model:</span>
                    <span class="font-mono text-xs">{result.metadata.model}</span>
                  </div>
                  {#if result.metadata.cost}
                    <div class="flex justify-between items-start mt-1 pt-1 border-t border-base-content/10">
                      <span>💰 Cost:</span>
                      <div class="text-right font-semibold">
                        <div>{formatCurrency(result.metadata.cost.usd, 'USD')}</div>
                        <div class="opacity-70">{formatCurrency(result.metadata.cost.aud, 'AUD')}</div>
                        <div class="opacity-70">{formatCurrency(result.metadata.cost.npr, 'NPR')}</div>
                      </div>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Question Display -->
      <div class="mt-8 card bg-base-200 shadow">
        <div class="card-body">
          <h4 class="font-semibold text-sm opacity-70">Your Question:</h4>
          <p class="text-base">{question}</p>
        </div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if !comparisonResults && !isLoading}
      <div class="text-center py-16">
        <span class="text-6xl block mb-4">🤖</span>
        <h4 class="text-2xl font-semibold mb-2">Compare AI Responses</h4>
        <p class="text-base-content/70 mb-4">Ask a question and see how different AI models respond</p>
        <div class="flex gap-4 justify-center text-sm opacity-70">
          <span>🟣 Claude</span>
          <span>🔵 DeepSeek</span>
          <span>🟢 Gemini</span>
        </div>
      </div>
    {/if}
  </main>
{/if}
