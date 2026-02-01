<script lang="ts">
  import { onMount } from 'svelte';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let applications: any[] = [];
  let isLoading = true;
  let error = '';
  let platformFilter = '';
  let statusFilter = '';
  let fromDate = '';
  let toDate = '';

  onMount(() => {
    loadApplications();
  });

  async function loadApplications() {
    isLoading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      if (platformFilter) params.set('platform', platformFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/job-applications?${params.toString()}`, { headers });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        applications = data.data;
      } else {
        applications = [];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load applications';
      applications = [];
    } finally {
      isLoading = false;
    }
  }

  function formatDate(d: string | Date | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  function appliedAt(app: any): string {
    const t = app.application?.appliedAt ?? app.lastUpdatedAt;
    return formatDate(t);
  }
</script>

<svelte:head>
  <title>Job Analytics – Applications</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto">
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Job Analytics</h1>
      <p class="text-base-content/70 text-sm">Applications recorded from Seek (and other bots).</p>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 bg-base-200 rounded-lg p-4">
      <div class="form-control">
        <label for="filter-platform" class="label py-0"><span class="label-text">Platform</span></label>
        <select id="filter-platform" class="select select-bordered select-sm w-32" bind:value={platformFilter}>
          <option value="">All</option>
          <option value="seek">Seek</option>
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
        </select>
      </div>
      <div class="form-control">
        <label for="filter-status" class="label py-0"><span class="label-text">Status</span></label>
        <select id="filter-status" class="select select-bordered select-sm w-32" bind:value={statusFilter}>
          <option value="">All</option>
          <option value="applied">Applied</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
        </select>
      </div>
      <div class="form-control">
        <label for="filter-from" class="label py-0"><span class="label-text">From</span></label>
        <input id="filter-from" type="date" class="input input-bordered input-sm w-40" bind:value={fromDate} />
      </div>
      <div class="form-control">
        <label for="filter-to" class="label py-0"><span class="label-text">To</span></label>
        <input id="filter-to" type="date" class="input input-bordered input-sm w-40" bind:value={toDate} />
      </div>
      <button class="btn btn-primary btn-sm" on:click={loadApplications}>Apply</button>
    </div>

    {#if error}
      <div class="alert alert-error">
        <span>{error}</span>
        <button type="button" class="btn btn-ghost btn-sm" on:click={loadApplications}>Retry</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else if applications.length === 0}
      <div class="card bg-base-200">
        <div class="card-body items-center text-center py-12">
          <p class="text-base-content/70">No applications found.</p>
          <p class="text-sm text-base-content/60">Run the Seek bot and complete Quick Apply flows to see them here.</p>
        </div>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Applied</th>
              <th>Title</th>
              <th>Company</th>
              <th>Platform</th>
              <th>Location</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each applications as app}
              <tr>
                <td class="whitespace-nowrap">{appliedAt(app)}</td>
                <td class="font-medium">{app.title || '—'}</td>
                <td>{app.company || '—'}</td>
                <td><span class="badge badge-ghost">{app.platform || '—'}</span></td>
                <td class="text-sm text-base-content/70">{app.location || '—'}</td>
                <td><span class="badge badge-sm">{app.status || '—'}</span></td>
                <td>
                  <a href="/job-analytics/{app._id}" class="btn btn-ghost btn-sm">View</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
