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

      // Redirect all authenticated users to dashboard
      goto('/dashboard');
    }
  });

  function handleAuthenticated(event: CustomEvent) {
    isAuthenticated = true;
    user = event.detail.user;

    // Redirect all authenticated users to dashboard
    goto('/dashboard');
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
  <!-- Login page for unauthenticated users -->
  <div class="container mx-auto max-w-md px-4">
    <div class="text-center mb-12">
      <h1 class="text-6xl font-bold mb-4 text-primary">🚀 RAG System</h1>
      <p class="text-xl text-base-content/70">AI-Powered Document Intelligence</p>
    </div>

    <SimpleLogin on:authenticated={handleAuthenticated} />
  </div>
</main>

