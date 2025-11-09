<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';

  let user = null;
  let isLoading = true;
  let sessionToken = '';

  onMount(async () => {
    sessionToken = localStorage.getItem('session_token') || '';
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      user = JSON.parse(storedUser);
    }

    // Verify and refresh user data
    if (sessionToken) {
      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            user = data.user;
            localStorage.setItem('user', JSON.stringify(user));
          }
        }
      } catch (error) {
        console.error('Failed to verify session:', error);
      }
    }

    isLoading = false;
  });

  function getUserTypeColor(userType) {
    if (userType === 'admin') return 'error';
    if (userType === 'premium') return 'warning';
    return 'info';
  }

  function getUserTypeDescription(userType) {
    if (userType === 'admin') return 'Full access to all features and admin controls';
    if (userType === 'premium') return 'Access to all premium features';
    return 'Limited access - upgrade to premium for more features';
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">👤 Profile</h1>
    <p class="text-base-content/70">View your account information and permissions</p>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if user}
    <div class="grid grid-cols-1 gap-6">
      <!-- User Info Card -->
      <div class="card bg-base-100 shadow-xl border-2">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-4">
            <div class="avatar">
              <div class="w-16 rounded-full ring ring-primary ring-offset-2">
                {#if user.picture}
                  <img src={user.picture} alt={user.name} />
                {:else}
                  <div class="bg-primary text-primary-content flex items-center justify-center text-2xl font-bold">
                    {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                {/if}
              </div>
            </div>
            <div>
              <div class="text-2xl">{user.name}</div>
              <div class="text-sm text-base-content/70 font-normal">{user.email}</div>
            </div>
          </h2>

          <div class="divider"></div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Account Type -->
            <div class="stat bg-base-200 rounded-lg p-4">
              <div class="stat-title">Account Type</div>
              <div class="stat-value text-2xl">
                <span class="badge badge-lg badge-{getUserTypeColor(user.userType)} gap-2">
                  {user.userType}
                </span>
              </div>
              <div class="stat-desc">{getUserTypeDescription(user.userType)}</div>
            </div>

            <!-- Payment Status -->
            <div class="stat bg-base-200 rounded-lg p-4">
              <div class="stat-title">Payment Status</div>
              <div class="stat-value text-2xl">
                <span class="badge badge-lg {user.isPaid ? 'badge-success' : 'badge-ghost'} gap-2">
                  {user.isPaid ? '✅ Paid' : '🆓 Free'}
                </span>
              </div>
              <div class="stat-desc">
                {user.isPaid ? 'All premium features enabled' : 'Upgrade for full access'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Permissions Card -->
      <div class="card bg-base-100 shadow-xl border-2">
        <div class="card-body">
          <h2 class="card-title">🔐 API Permissions</h2>
          <p class="text-base-content/70 text-sm mb-4">
            These are the API endpoints you have access to
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each Object.entries(user.apiPermissions || {}) as [key, enabled]}
              <div class="flex items-center justify-between p-3 rounded-lg {enabled ? 'bg-success/20 border border-success' : 'bg-base-200'}">
                <div class="flex items-center gap-2">
                  {#if enabled}
                    <span class="text-success text-xl">✅</span>
                  {:else}
                    <span class="text-base-content/30 text-xl">❌</span>
                  {/if}
                  <span class="font-medium {enabled ? 'text-success-content' : 'text-base-content/50'}">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Session Token Card (for developers) -->
      <div class="card bg-base-100 shadow-xl border-2">
        <div class="card-body">
          <h2 class="card-title">🔑 Session Token</h2>
          <p class="text-base-content/70 text-sm mb-4">
            Use this token for API requests
          </p>

          <div class="flex gap-2">
            <input
              type="text"
              class="input input-bordered flex-1 font-mono text-sm"
              value={sessionToken}
              readonly
            />
            <button class="btn btn-primary" on:click={() => copyToClipboard(sessionToken)}>
              📋 Copy
            </button>
          </div>

          <div class="alert alert-info mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="text-sm">
              Include this token in the <code class="bg-base-300 px-2 py-1 rounded">Authorization: Bearer &lt;token&gt;</code> header for API requests
            </span>
          </div>
        </div>
      </div>

      <!-- Account Actions -->
      <div class="card bg-base-100 shadow-xl border-2">
        <div class="card-body">
          <h2 class="card-title">⚙️ Account Actions</h2>

          <div class="flex flex-col gap-3">
            {#if user.userType === 'freetier'}
              <button class="btn btn-primary btn-lg">
                ⭐ Upgrade to Premium
              </button>
            {/if}

            {#if user.userType === 'admin'}
              <a href="/admin" class="btn btn-error btn-lg">
                🛠️ Admin Dashboard
              </a>
            {/if}

            <button class="btn btn-ghost" on:click={() => window.location.href = '/'}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body text-center">
        <h2 class="text-2xl font-bold mb-4">Not logged in</h2>
        <p class="text-base-content/70 mb-4">Please log in to view your profile</p>
        <a href="/" class="btn btn-primary">Go to Login</a>
      </div>
    </div>
  {/if}
</main>
