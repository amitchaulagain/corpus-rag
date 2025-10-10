<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GoogleAuth from '$lib/components/GoogleAuth.svelte';

  let isAuthenticated = false;
  let user: any = null;

  onMount(() => {
    // Check if already authenticated with new session token system
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;

      // Redirect admin users to dashboard
      if (user.userType === 'admin') {
        goto('/dashboard');
      }
    }
  });

  function handleAuthenticated(event: CustomEvent) {
    isAuthenticated = true;
    user = event.detail.user;

    // Redirect admin users to dashboard
    if (user.userType === 'admin') {
      goto('/dashboard');
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
  }
</script>

<main class="container mx-auto max-w-4xl p-10 min-h-screen relative">
  {#if isAuthenticated && user && user.userType !== 'admin'}
    <!-- Non-admin users see access denied message -->
    <div class="text-center mt-20">
      <div class="card bg-error/10 border-2 border-error shadow-xl p-10 max-w-lg mx-auto">
        <span class="text-6xl mb-6">🚫</span>
        <h1 class="text-3xl font-bold mb-4 text-error">Access Denied</h1>
        <p class="text-base-content/70 mb-6">This application is restricted to administrators only.</p>
        <p class="text-sm text-base-content/60 mb-6">Please contact an administrator to request access.</p>
        <button class="btn btn-error" on:click={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  {:else}
    <!-- Login page for unauthenticated users -->
    <div class="text-center">
      <header class="mb-12">
        <h1 class="text-5xl font-bold mb-4 text-primary">🚀 RAG System</h1>
        <p class="text-xl text-base-content/70">AI-Powered Document Intelligence</p>
      </header>

      <div class="card bg-base-100 shadow-xl border-2 p-10 mb-12 max-w-md mx-auto">
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

