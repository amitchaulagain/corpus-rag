<script>
  import { onMount } from 'svelte';

  let ollamaStatus = 'checking';
  let installedModels = [];
  let isLoading = false;
  let baseUrl = 'http://localhost:11434';

  onMount(() => {
    checkOllamaStatus();
  });

  async function checkOllamaStatus() {
    isLoading = true;
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        installedModels = data.models || [];
        ollamaStatus = 'running';
      } else {
        ollamaStatus = 'error';
      }
    } catch (error) {
      ollamaStatus = 'offline';
    } finally {
      isLoading = false;
    }
  }

  async function pullModel(modelName) {
    alert(`To pull ${modelName}, run this command in your terminal:\n\nollama pull ${modelName}`);
  }

  function getModelIcon(name) {
    if (name.includes('llama')) return '🦙';
    if (name.includes('mistral')) return '🌪️';
    if (name.includes('gemma')) return '💎';
    if (name.includes('codellama')) return '💻';
    return '🤖';
  }

  function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 ** 3);
    return gb.toFixed(2) + ' GB';
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🦙 Ollama Management</h1>
    <p class="text-base-content/70">Manage your local Ollama server and models</p>
  </header>

  <!-- Server Status Card -->
  <div class="card bg-base-100 shadow-xl mb-6">
    <div class="card-body">
      <h2 class="card-title">Server Status</h2>

      <div class="flex items-center gap-4 mb-4">
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span>Checking status...</span>
        {:else if ollamaStatus === 'running'}
          <div class="badge badge-success gap-2">
            <div class="w-2 h-2 rounded-full bg-white"></div>
            Running
          </div>
          <span>Ollama server is running at {baseUrl}</span>
        {:else if ollamaStatus === 'offline'}
          <div class="badge badge-error gap-2">
            <div class="w-2 h-2 rounded-full bg-white"></div>
            Offline
          </div>
          <span>Ollama server is not running</span>
        {:else}
          <div class="badge badge-warning gap-2">
            <div class="w-2 h-2 rounded-full bg-white"></div>
            Error
          </div>
          <span>Error connecting to Ollama</span>
        {/if}
      </div>

      {#if ollamaStatus === 'offline'}
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <h3 class="font-bold">Ollama is not running</h3>
            <div class="text-sm">Start Ollama by running: <code class="bg-base-300 px-2 py-1 rounded">ollama serve</code></div>
          </div>
        </div>
      {/if}

      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary" on:click={checkOllamaStatus}>
          Refresh Status
        </button>
      </div>
    </div>
  </div>

  <!-- Installed Models -->
  {#if ollamaStatus === 'running'}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">Installed Models ({installedModels.length})</h2>

        {#if installedModels.length === 0}
          <div class="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>No models installed yet. Install a model using: <code class="bg-base-300 px-2 py-1 rounded">ollama pull llama2</code></span>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Size</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>
                {#each installedModels as model}
                  <tr>
                    <td>
                      <div class="flex items-center gap-2">
                        <span class="text-2xl">{getModelIcon(model.name)}</span>
                        <div>
                          <div class="font-bold">{model.name}</div>
                          <div class="text-sm opacity-50">{model.digest?.slice(0, 12)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatSize(model.size)}</td>
                    <td>{new Date(model.modified_at).toLocaleDateString()}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>
