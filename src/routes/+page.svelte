<script lang="ts">
  import { onMount } from 'svelte';
  import GoogleAuth from '$lib/components/GoogleAuth.svelte';

  let isAuthenticated = false;
  let user: any = null;

  onMount(() => {
    // Handle OAuth redirect - if code is in URL, process it here
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Check if already authenticated
    const storedToken = localStorage.getItem('google_access_token');
    const storedUser = localStorage.getItem('google_user');

    if (storedToken && storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;
    }
  });

  function handleAuthenticated(event: CustomEvent) {
    isAuthenticated = true;
    user = event.detail.user;
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user');
  }
</script>

<main class="container mx-auto max-w-4xl p-10 min-h-screen">
  {#if isAuthenticated && user}
    <!-- Welcome authenticated user -->
    <div class="card bg-success/20 border-2 border-success p-8 mb-10">
      <div class="flex flex-col lg:flex-row items-center gap-6">
        <div class="avatar">
          <div class="w-20 rounded-full ring ring-success ring-offset-2">
            <img src={user.picture} alt={user.name} />
          </div>
        </div>
        <div class="flex-1 text-center lg:text-left">
          <h1 class="text-3xl font-bold text-success-content mb-2">Welcome, {user.name}!</h1>
          <p class="text-success-content/70">{user.email}</p>
        </div>
        <button class="btn btn-error" on:click={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>

    <!-- Main navigation for authenticated users -->
    <nav class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-2xl mx-auto">
      <a href="/files" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">🗄️</span>
          <h3 class="card-title text-2xl mb-2">Files</h3>
          <p class="text-base-content/70">Upload and manage documents</p>
        </div>
      </a>

      <a href="/search" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">🔍</span>
          <h3 class="card-title text-2xl mb-2">Search</h3>
          <p class="text-base-content/70">Query your documents with AI</p>
        </div>
      </a>

      <a href="/cover-letters" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">✍️</span>
          <h3 class="card-title text-2xl mb-2">Cover Letters</h3>
          <p class="text-base-content/70">AI-generated cover letters</p>
        </div>
      </a>

      <a href="/employer-questions" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">❓</span>
          <h3 class="card-title text-2xl mb-2">Q&A</h3>
          <p class="text-base-content/70">Employer screening answers</p>
        </div>
      </a>
    </nav>
  {:else}
    <!-- Login page for unauthenticated users -->
    <div class="text-center">
      <header class="mb-12">
        <h1 class="text-5xl font-bold mb-4 text-primary">🚀 RAG System</h1>
        <p class="text-xl text-base-content/70">AI-Powered Document Intelligence</p>
      </header>

      <div class="card bg-base-100 shadow-xl border-2 p-10 mb-12 max-w-md mx-auto">
        <h2 class="text-2xl font-bold mb-4">Sign in to continue</h2>
        <p class="text-base-content/70 mb-8">Access your documents and AI-powered search</p>
        <GoogleAuth on:authenticated={handleAuthenticated} />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        <div class="text-center">
          <span class="text-5xl block mb-4">📤</span>
          <h4 class="text-lg font-semibold mb-2">Upload Documents</h4>
          <p class="text-base-content/70 text-sm">Securely store your files in the cloud</p>
        </div>
        <div class="text-center">
          <span class="text-5xl block mb-4">🤖</span>
          <h4 class="text-lg font-semibold mb-2">AI Search</h4>
          <p class="text-base-content/70 text-sm">Ask questions about your documents</p>
        </div>
        <div class="text-center">
          <span class="text-5xl block mb-4">🔒</span>
          <h4 class="text-lg font-semibold mb-2">Secure & Private</h4>
          <p class="text-base-content/70 text-sm">Your data is protected and isolated</p>
        </div>
      </div>
    </div>
  {/if}
</main>

