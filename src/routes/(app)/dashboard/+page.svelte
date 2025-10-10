<script>
  import { onMount } from 'svelte';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  let stats = {
    totalUsers: 0,
    adminUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    totalApiCalls: 0,
    todayApiCalls: 0
  };

  let recentActivity = [];
  let isLoading = true;

  onMount(async () => {
    await loadStats();
    await loadActivity();
    isLoading = false;
  });

  async function loadStats() {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          stats = data.stats;
        }
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function loadActivity() {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/admin/activity', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          recentActivity = data.activity;
        }
      }
    } catch (error) {
      console.error('Failed to load activity:', error);
    }
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-2 text-primary">📊 Dashboard</h1>
    <p class="text-base-content/70">System overview and statistics</p>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <!-- Total Users -->
      <div class="stat bg-gradient-to-br from-primary to-primary/70 text-primary-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">👥</div>
        <div class="stat-title text-primary-content/80">Total Users</div>
        <div class="stat-value">{stats.totalUsers}</div>
        <div class="stat-desc text-primary-content/60">Registered accounts</div>
      </div>

      <!-- Admin Users -->
      <div class="stat bg-gradient-to-br from-error to-error/70 text-error-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">👑</div>
        <div class="stat-title text-error-content/80">Admins</div>
        <div class="stat-value">{stats.adminUsers}</div>
        <div class="stat-desc text-error-content/60">Administrator accounts</div>
      </div>

      <!-- Premium Users -->
      <div class="stat bg-gradient-to-br from-warning to-warning/70 text-warning-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">⭐</div>
        <div class="stat-title text-warning-content/80">Premium</div>
        <div class="stat-value">{stats.premiumUsers}</div>
        <div class="stat-desc text-warning-content/60">Paid subscribers</div>
      </div>

      <!-- Free Users -->
      <div class="stat bg-gradient-to-br from-info to-info/70 text-info-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">🆓</div>
        <div class="stat-title text-info-content/80">Free Tier</div>
        <div class="stat-value">{stats.freeUsers}</div>
        <div class="stat-desc text-info-content/60">Free accounts</div>
      </div>

      <!-- API Calls Today -->
      <div class="stat bg-gradient-to-br from-success to-success/70 text-success-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">📈</div>
        <div class="stat-title text-success-content/80">API Calls Today</div>
        <div class="stat-value">{stats.todayApiCalls}</div>
        <div class="stat-desc text-success-content/60">Requests processed</div>
      </div>

      <!-- Total API Calls -->
      <div class="stat bg-gradient-to-br from-accent to-accent/70 text-accent-content rounded-xl shadow-xl">
        <div class="stat-figure text-4xl opacity-50">🚀</div>
        <div class="stat-title text-accent-content/80">Total API Calls</div>
        <div class="stat-value">{stats.totalApiCalls.toLocaleString()}</div>
        <div class="stat-desc text-accent-content/60">All-time requests</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <a href="/users" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">👥</span>
          <h3 class="card-title text-2xl">User Management</h3>
          <p class="text-base-content/70">Manage users and permissions</p>
        </div>
      </a>

      <a href="/cover-letters" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">✍️</span>
          <h3 class="card-title text-2xl">Cover Letters</h3>
          <p class="text-base-content/70">Generate cover letters</p>
        </div>
      </a>

      <a href="/settings" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 border-2 hover:border-primary">
        <div class="card-body items-center text-center">
          <span class="text-6xl mb-4">⚙️</span>
          <h3 class="card-title text-2xl">AI Settings</h3>
          <p class="text-base-content/70">Configure AI providers</p>
        </div>
      </a>
    </div>

    <!-- Recent Activity -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">📝 Recent Activity</h2>

        {#if recentActivity.length === 0}
          <div class="text-center py-8 text-base-content/50">
            <p>No recent activity</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each recentActivity as activity}
                  <tr>
                    <td class="text-sm">{new Date(activity.timestamp).toLocaleString()}</td>
                    <td>{activity.userName}</td>
                    <td>{activity.action}</td>
                    <td>
                      <span class="badge {activity.success ? 'badge-success' : 'badge-error'}">
                        {activity.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
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
</AdminGuard>
