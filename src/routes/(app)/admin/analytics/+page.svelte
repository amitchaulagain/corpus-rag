<!-- RBAC Analytics Dashboard -->
<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let analytics: any = null;
  let isLoading = false;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      const currentUser = JSON.parse(storedUser);
      if (currentUser.userType !== 'admin') {
        alert('Access denied - Admin only');
        window.location.href = '/';
        return;
      }
    } else {
      alert('Please log in');
      window.location.href = '/';
      return;
    }

    await loadAnalytics();
  });

  async function loadAnalytics() {
    isLoading = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/analytics/rbac', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          analytics = data.analytics;
        }
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">📊 RBAC Analytics</h1>
      <p class="text-base-content/70">System statistics and insights</p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary" on:click={loadAnalytics}>🔄 Refresh</button>
      <a href="/admin" class="btn btn-ghost">← Back to Admin</a>
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if analytics}
    <!-- Users Statistics -->
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title mb-4">👥 Users Statistics</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Total Users</div>
            <div class="stat-value text-primary">{analytics.users.total}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">With Roles</div>
            <div class="stat-value text-secondary">{analytics.users.withRoles}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Agents</div>
            <div class="stat-value text-accent">{analytics.users.agents}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Admins</div>
            <div class="stat-value">{analytics.users.byType.admin}</div>
          </div>
        </div>
        <div class="mt-4">
          <h3 class="font-semibold mb-2">User Type Distribution</h3>
          <div class="flex gap-2">
            <span class="badge badge-primary">Premium: {analytics.users.byType.premium}</span>
            <span class="badge badge-secondary">Free Tier: {analytics.users.byType.freetier}</span>
            <span class="badge badge-accent">Admin: {analytics.users.byType.admin}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Roles Statistics -->
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title mb-4">📋 Roles Statistics</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Total Roles</div>
            <div class="stat-value text-primary">{analytics.roles.total}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">System Roles</div>
            <div class="stat-value text-secondary">{analytics.roles.systemRoles}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Custom Roles</div>
            <div class="stat-value text-accent">{analytics.roles.customRoles}</div>
          </div>
        </div>
        <div class="mt-4">
          <h3 class="font-semibold mb-2">Role Distribution</h3>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(analytics.roles.distribution) as [role, count]}
              <span class="badge badge-primary">
                {role}: {count}
              </span>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Departments Statistics -->
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title mb-4">🏢 Departments Statistics</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Total Departments</div>
            <div class="stat-value text-primary">{analytics.departments.total}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Active Departments</div>
            <div class="stat-value text-secondary">{analytics.departments.active}</div>
          </div>
        </div>
        <div class="mt-4">
          <h3 class="font-semibold mb-2">Department Distribution</h3>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(analytics.departments.distribution) as [dept, count]}
              <span class="badge badge-outline">
                {dept}: {count} users
              </span>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Agents Statistics -->
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title mb-4">🤝 Agents Statistics</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Total Agents</div>
            <div class="stat-value text-primary">{analytics.agents.total}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Active Agents</div>
            <div class="stat-value text-secondary">{analytics.agents.active}</div>
          </div>
          <div class="stat bg-base-200 rounded-box">
            <div class="stat-title">Inactive Agents</div>
            <div class="stat-value text-error">
              {analytics.agents.total - analytics.agents.active}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Statistics -->
    {#if analytics.activity}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title mb-4">📈 Activity (Last 30 Days)</h2>
          <div class="stat bg-base-200 rounded-box mb-4">
            <div class="stat-title">Total Actions</div>
            <div class="stat-value text-primary">
              {analytics.activity.last30Days.totalActions}
            </div>
          </div>
          <div class="mt-4">
            <h3 class="font-semibold mb-2">Actions by Type</h3>
            <div class="flex flex-wrap gap-2">
              {#each Object.entries(analytics.activity.last30Days.byAction) as [action, count]}
                <span class="badge badge-primary">
                  {action}: {count}
                </span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</main>
