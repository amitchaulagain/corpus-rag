<script lang="ts">
  import { onMount } from 'svelte';

  let providers: any[] = [];
  let isLoading = false;
  let user: any = null;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
    }
    await loadProviders();
  });

  async function loadProviders() {
    isLoading = true;
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      if (data.success) {
        providers = data.providers;
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      alert('Failed to load providers');
    } finally {
      isLoading = false;
    }
  }

  async function toggleProvider(providerId: string, currentState: boolean) {
    try {
      const response = await fetch('/api/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: providerId,
          enabled: !currentState
        })
      });

      const data = await response.json();
      if (data.success) {
        await loadProviders();
      } else {
        alert('Failed to update provider: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to toggle provider:', error);
      alert('Failed to update provider');
    }
  }

  function getProviderIcon(type: string): string {
    if (type.includes('claude')) return '🟣';
    if (type.includes('deepseek')) return '🔵';
    if (type.includes('gemini')) return '🟢';
    if (type === 'ollama') return '🦙';
    return '🤖';
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">⚙️ AI Provider Settings</h1>
    <p class="text-base-content/70">Manage which AI providers are active for search, cover letters, and other features</p>
  </header>

  {#if isLoading}
    <div class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each providers as provider}
        <div class="card bg-base-100 shadow-xl border-2" style="border-color: {provider.enabled ? 'green' : 'gray'};">
          <div class="card-body">
            <!-- Provider Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="card-title text-xl">
                {getProviderIcon(provider.type)} {provider.name}
              </h3>
              <input
                type="checkbox"
                class="toggle toggle-lg {provider.enabled ? 'toggle-success' : 'toggle-error'}"
                checked={provider.enabled}
                disabled={!provider.hasApiKey}
                on:change={() => toggleProvider(provider.id, provider.enabled)}
              />
            </div>

            <!-- Provider Info -->
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="opacity-70">Type:</span>
                <span class="font-semibold">{provider.type}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="opacity-70">Model:</span>
                <span class="font-mono text-xs">{provider.model}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="opacity-70">API Key:</span>
                {#if provider.type === 'ollama'}
                  <span class="badge badge-info badge-sm">Local (No Key)</span>
                {:else if provider.hasApiKey}
                  <span class="badge badge-success badge-sm">✓ Configured</span>
                {:else}
                  <span class="badge badge-error badge-sm">✗ Missing</span>
                {/if}
              </div>
              <div class="flex justify-between text-sm">
                <span class="opacity-70">Status:</span>
                {#if !provider.hasApiKey && provider.type !== 'ollama'}
                  <span class="badge badge-warning badge-sm">No API Key</span>
                {:else if provider.enabled}
                  <span class="badge badge-success badge-sm">Active</span>
                {:else}
                  <span class="badge badge-error badge-sm">Disabled</span>
                {/if}
              </div>
            </div>

            {#if !provider.hasApiKey && provider.type !== 'ollama'}
              <div class="alert alert-warning mt-4 text-xs">
                <span>⚠️ Configure API key in <code>src/config/providers.json</code></span>
              </div>
            {:else if provider.type === 'ollama'}
              <div class="alert alert-info mt-4 text-xs">
                <span>💡 Runs locally via Ollama (http://localhost:11434)</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if providers.length === 0}
      <div class="text-center py-16">
        <span class="text-6xl block mb-4">🤖</span>
        <h3 class="text-2xl font-semibold mb-2">No Providers Found</h3>
        <p class="text-base-content/70">Configure providers in <code>src/config/providers.json</code></p>
      </div>
    {/if}

    <!-- Info Box -->
    <div class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card bg-base-200">
        <div class="card-body">
          <h4 class="font-semibold mb-2">ℹ️ How It Works</h4>
          <ul class="space-y-2 text-sm opacity-80">
            <li>• Toggle providers ON/OFF to control which AIs are used</li>
            <li>• Disabled providers won't be queried in Search or Cover Letters</li>
            <li>• Changes take effect immediately</li>
            <li>• Providers without API keys cannot be enabled</li>
          </ul>
        </div>
      </div>

      <div class="card bg-info/10 border-2 border-info">
        <div class="card-body">
          <h4 class="font-semibold mb-2">🔑 Configure API Keys</h4>
          <p class="text-sm opacity-90 mb-3">Add your API keys to the <code class="bg-base-300 px-2 py-1 rounded">.env</code> file in your project root:</p>
          <div class="mockup-code text-xs">
            <pre data-prefix="$"><code>CLAUDE_API_KEY=sk-ant-...</code></pre>
            <pre data-prefix="$"><code>DEEPSEEK_API_KEY=sk-...</code></pre>
            <pre data-prefix="$"><code>GEMINI_API_KEY=...</code></pre>
          </div>
          <p class="text-xs opacity-70 mt-3">⚠️ Restart the server after adding API keys</p>
        </div>
      </div>
    </div>
  {/if}
</main>
