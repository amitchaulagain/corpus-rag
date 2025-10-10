<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let isChecking = true;
  let isAdmin = false;
  let user: any = null;

  onMount(async () => {
    if (!browser) return;

    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      // No user logged in
      window.location.href = '/';
      return;
    }

    user = JSON.parse(storedUser);

    // Check if admin
    if (user.userType !== 'admin') {
      alert('Access Denied - Admin Only');
      window.location.href = '/';
      return;
    }

    isAdmin = true;
    isChecking = false;
  });
</script>

{#if isChecking}
  <div class="flex justify-center items-center min-h-screen">
    <div class="text-center">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="mt-4 text-base-content/70">Checking access...</p>
    </div>
  </div>
{:else if isAdmin}
  <slot />
{:else}
  <div class="flex justify-center items-center min-h-screen">
    <div class="card bg-error/20 border-2 border-error shadow-xl max-w-md">
      <div class="card-body text-center">
        <h2 class="text-3xl mb-4">🚫</h2>
        <h3 class="card-title justify-center">Access Denied</h3>
        <p class="text-error-content/70">This page is only accessible to administrators</p>
        <div class="card-actions justify-center mt-4">
          <a href="/" class="btn btn-primary">Go to Home</a>
        </div>
      </div>
    </div>
  </div>
{/if}
