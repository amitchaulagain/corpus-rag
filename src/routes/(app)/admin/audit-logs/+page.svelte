<!-- Audit Logs Viewer -->
<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let logs: any[] = [];
  let isLoading = false;
  let filters = {
    userId: '',
    action: '',
    startDate: '',
    endDate: '',
    limit: 100
  };
  let statistics = null;

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

    await Promise.all([loadLogs(), loadStatistics()]);
  });

  async function loadLogs() {
    isLoading = true;
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', filters.limit.toString());

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          logs = data.logs;
        }
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadStatistics() {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/audit-logs/statistics?${params.toString()}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          statistics = data.statistics;
        }
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  function applyFilters() {
    loadLogs();
    loadStatistics();
  }

  function clearFilters() {
    filters = {
      userId: '',
      action: '',
      startDate: '',
      endDate: '',
      limit: 100
    };
    loadLogs();
    loadStatistics();
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">📋 Audit Logs</h1>
      <p class="text-base-content/70">System activity and security audit trail</p>
    </div>
    <div class="flex gap-2">
      <a href="/admin" class="btn btn-ghost">← Back to Admin</a>
    </div>
  </div>

  <!-- Statistics -->
  {#if statistics}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Total Actions</div>
        <div class="stat-value text-primary">{statistics.total}</div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Top Action</div>
        <div class="stat-value text-sm">
          {Object.keys(statistics.byAction)[0] || 'N/A'}
        </div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Resource Types</div>
        <div class="stat-value text-sm">
          {Object.keys(statistics.byResourceType).length}
        </div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Active Users</div>
        <div class="stat-value text-sm">
          {statistics.byUser.length}
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="card bg-base-100 shadow-xl mb-6">
    <div class="card-body">
      <h2 class="card-title mb-4">Filters</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text">User ID</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered" 
            bind:value={filters.userId}
            placeholder="Filter by user"
          />
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Action</span>
          </label>
          <select class="select select-bordered" bind:value={filters.action}>
            <option value="">All Actions</option>
            <option value="role_assigned">Role Assigned</option>
            <option value="role_removed">Role Removed</option>
            <option value="agent_application_submitted">Agent Application</option>
            <option value="charge_processed">Charge Processed</option>
            <option value="charge_refunded">Charge Refunded</option>
            <option value="department_created">Department Created</option>
          </select>
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Start Date</span>
          </label>
          <input 
            type="date" 
            class="input input-bordered" 
            bind:value={filters.startDate}
          />
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">End Date</span>
          </label>
          <input 
            type="date" 
            class="input input-bordered" 
            bind:value={filters.endDate}
          />
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Limit</span>
          </label>
          <input 
            type="number" 
            class="input input-bordered" 
            bind:value={filters.limit}
            min="1"
            max="1000"
          />
        </div>
        <div class="form-control flex items-end">
          <div class="flex gap-2">
            <button class="btn btn-primary" on:click={applyFilters}>Apply Filters</button>
            <button class="btn btn-ghost" on:click={clearFilters}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Logs Table -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title mb-4">Audit Logs ({logs.length})</h2>
      {#if isLoading}
        <div class="flex justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User</th>
                <th>Resource</th>
                <th>Description</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as log}
                <tr>
                  <td>{formatDate(log.timestamp)}</td>
                  <td>
                    <span class="badge badge-primary">{log.action}</span>
                  </td>
                  <td>{log.userId || 'System'}</td>
                  <td>
                    <span class="badge badge-outline">
                      {log.resourceType}
                    </span>
                  </td>
                  <td class="max-w-md truncate">{log.details.description}</td>
                  <td class="text-sm">{log.ipAddress || 'N/A'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</main>
