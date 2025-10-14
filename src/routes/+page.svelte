<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SimpleLogin from '$lib/components/SimpleLogin.svelte';

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

<main class="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
  {#if isAuthenticated && user && user.userType !== 'admin'}
    <!-- Non-admin users see access denied message -->
    <div class="container mx-auto max-w-lg px-4">
      <div class="card bg-error/10 border-2 border-error shadow-2xl p-10">
        <span class="text-7xl mb-6">🚫</span>
        <h1 class="text-4xl font-bold mb-4 text-error">Access Denied</h1>
        <p class="text-lg text-base-content/70 mb-6">This application is restricted to administrators only.</p>
        <button class="btn btn-error btn-lg" on:click={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  {:else}
    <!-- Login page for unauthenticated users -->
    <div class="container mx-auto max-w-md px-4">
      <div class="text-center mb-12">
        <h1 class="text-6xl font-bold mb-4 text-primary">🚀 RAG System</h1>
        <p class="text-xl text-base-content/70">AI-Powered Document Intelligence</p>
      </div>

      <SimpleLogin on:authenticated={handleAuthenticated} />
    </div>
  {/if}
</main>

