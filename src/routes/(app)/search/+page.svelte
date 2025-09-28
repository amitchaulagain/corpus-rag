<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  let isAuthenticated = false;
  let user: any = null;
  let question = '';
  let answer = '';
  let isLoading = false;
  let searchHistory: Array<{question: string, answer: string, timestamp: string}> = [];

  onMount(() => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;

      // Load search history from localStorage
      const history = localStorage.getItem('search_history');
      if (history) {
        try {
          const parsedHistory = JSON.parse(history);
          // Filter out any corrupted entries
          searchHistory = parsedHistory.filter((item: any) => 
            item && 
            typeof item.question === 'string' && 
            typeof item.answer === 'string' && 
            typeof item.timestamp === 'string'
          );
        } catch (error) {
          console.error('Error parsing search history:', error);
          searchHistory = [];
          localStorage.removeItem('search_history');
        }
      }
    }
  });

  async function handleSearch(event: Event) {
    event.preventDefault();

    if (!question.trim() || !user) return;

    isLoading = true;
    answer = '';

    try {
      const response = await apiRequest('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.email,
          question: question.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        // Handle both new API format (data.data.answer) and legacy format (data.answer)
        const answerText = data.data?.answer || data.answer;
        answer = answerText;

        // Add to search history
        const searchEntry = {
          question: question.trim(),
          answer: answerText,
          timestamp: new Date().toISOString()
        };

        searchHistory = [searchEntry, ...searchHistory].slice(0, 10); // Keep last 10
        localStorage.setItem('search_history', JSON.stringify(searchHistory));

      } else {
        answer = `Error: ${data.error || 'Search failed'}`;
      }
    } catch (error) {
      console.error('Search failed:', error);
      answer = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }

  function clearHistory() {
    searchHistory = [];
    localStorage.removeItem('search_history');
  }

  function clearCorruptedHistory() {
    console.log('Clearing corrupted search history...');
    searchHistory = [];
    localStorage.removeItem('search_history');
  }

  function useHistoryQuestion(q: string) {
    question = q;
  }

  // Debug function to clear corrupted data (can be called from browser console)
  if (typeof window !== 'undefined') {
    (window as any).clearSearchHistory = clearCorruptedHistory;
  }
</script>

{#if isAuthenticated && user}
<main class="container mx-auto max-w-6xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🔍 Search</h1>
    <p class="text-base-content/70">Ask questions about your documents using AI</p>
  </header>

  <!-- Search Form -->
  <div class="card bg-base-100 shadow-xl mb-8">
    <div class="card-body">
      <form on:submit={handleSearch} class="mb-4">
        <div class="flex gap-3">
          <input
            type="text"
            bind:value={question}
            placeholder="Ask a question about your documents..."
            class="input input-bordered flex-1"
            class:input-disabled={isLoading}
            disabled={isLoading}
          />
          <button
            type="submit"
            class="btn btn-primary"
            class:btn-disabled={isLoading || !question.trim()}
            class:loading={isLoading}
            disabled={isLoading || !question.trim()}
          >
            {#if isLoading}
              ⏳
            {:else}
              🔍
            {/if}
          </button>
        </div>
      </form>

      <!-- Answer Section -->
      {#if answer}
        <div class="alert alert-success">
          <div>
            <h3 class="font-bold text-lg mb-2">💡 Answer</h3>
            <div class="whitespace-pre-wrap leading-relaxed">
              {answer}
            </div>
          </div>
        </div>
      {/if}

      {#if isLoading}
        <div class="flex flex-col items-center py-12">
          <span class="loading loading-spinner loading-lg text-primary mb-4"></span>
          <p class="text-base-content/70">Searching your documents...</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Search History -->
  {#if searchHistory.length > 0}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="flex justify-between items-center mb-6">
          <h3 class="card-title text-xl">📚 Recent Searches</h3>
          <button class="btn btn-ghost btn-sm" on:click={clearHistory}>
            Clear History
          </button>
        </div>

        <div class="space-y-4">
          {#each searchHistory as item}
            <div class="card bg-base-200 shadow-sm">
              <div class="card-body p-4">
                <button
                  class="btn btn-ghost btn-sm justify-start p-0 h-auto min-h-0 font-semibold text-primary hover:text-primary-focus mb-2"
                  on:click={() => useHistoryQuestion(item.question)}
                >
                  {item.question}
                </button>
                <div class="text-sm opacity-70 mb-2 line-clamp-3">
                  {item.answer ? (item.answer.substring(0, 150) + (item.answer.length > 150 ? '...' : '')) : 'No answer available'}
                </div>
                <div class="text-xs opacity-50">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else if !isLoading && !answer}
    <div class="text-center py-16">
      <span class="text-6xl block mb-4">🤔</span>
      <h4 class="text-xl font-semibold mb-2">No searches yet</h4>
      <p class="text-base-content/70">Try asking a question about your uploaded documents</p>
    </div>
  {/if}
</main>
{/if}

