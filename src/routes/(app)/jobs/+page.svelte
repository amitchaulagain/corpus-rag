<script lang="ts">
  import { onMount } from 'svelte';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  let isLoading = true;
  let hierarchy: any[] = [];
  let stats: any = null;
  let selectedUser: string = '';
  let users: any[] = [];
  let expandedPlatforms: Set<string> = new Set();
  let expandedJobs: Set<string> = new Set();
  let expandedApiCalls: Set<string> = new Set();

  onMount(async () => {
    await loadUsers();
    if (users.length > 0) {
      selectedUser = users[0].id;
      await loadJobHierarchy();
    }
  });

  async function loadUsers() {
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/users-json', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        users = data.users || [];
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function loadJobHierarchy() {
    isLoading = true;
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch(`/api/jobs/hierarchy?userId=${selectedUser}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        hierarchy = data.hierarchy || [];
        stats = data.stats || {};
      }
    } catch (error) {
      console.error('Failed to load job hierarchy:', error);
    } finally {
      isLoading = false;
    }
  }

  function togglePlatform(platformId: string) {
    if (expandedPlatforms.has(platformId)) {
      expandedPlatforms.delete(platformId);
    } else {
      expandedPlatforms.add(platformId);
    }
    expandedPlatforms = expandedPlatforms;
  }

  function toggleJob(jobId: string) {
    if (expandedJobs.has(jobId)) {
      expandedJobs.delete(jobId);
    } else {
      expandedJobs.add(jobId);
    }
    expandedJobs = expandedJobs;
  }

  function toggleApiCalls(jobId: string) {
    const key = `${jobId}_api`;
    if (expandedApiCalls.has(key)) {
      expandedApiCalls.delete(key);
    } else {
      expandedApiCalls.add(key);
    }
    expandedApiCalls = expandedApiCalls;
  }

  function getStatusBadge(status: string) {
    const colors: any = {
      pending: 'badge-warning',
      applied: 'badge-info',
      rejected: 'badge-error',
      interview: 'badge-success',
      offer: 'badge-success',
      withdrawn: 'badge-ghost'
    };
    return colors[status] || 'badge-ghost';
  }

  function getPlatformIcon(platform: string) {
    const icons: any = {
      seek: '🔍',
      linkedin: '💼',
      indeed: '📋',
      other: '🌐'
    };
    return icons[platform] || '🌐';
  }

  function formatDate(date: any) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCost(cost: number) {
    return `$${cost.toFixed(4)}`;
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-6">
    <h1 class="text-3xl font-bold mb-4">📊 Job Application Tracking</h1>

    <!-- User Selection -->
    <div class="flex gap-4 mb-6">
      <div class="form-control flex-1">
        <label class="label">
          <span class="label-text">Select User</span>
        </label>
        <select class="select select-bordered" bind:value={selectedUser} on:change={loadJobHierarchy}>
          {#each users as user}
            <option value={user.id}>{user.name} ({user.email})</option>
          {/each}
        </select>
      </div>

      {#if stats}
        <div class="stats shadow">
          <div class="stat">
            <div class="stat-title">Total Jobs</div>
            <div class="stat-value text-primary">{stats.totalJobs}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Applications</div>
            <div class="stat-value text-secondary">{stats.totalApplications}</div>
          </div>
          <div class="stat">
            <div class="stat-title">API Calls</div>
            <div class="stat-value text-accent">{stats.totalApiCalls}</div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if hierarchy.length === 0}
    <div class="alert alert-info">
      <span>No job data found for this user. Jobs will appear here when the automation bot starts making API calls.</span>
    </div>
  {:else}
    <!-- Platform Hierarchy -->
    {#each hierarchy as platformGroup}
      <div class="card bg-base-100 shadow-xl mb-4">
        <div class="card-body">
          <!-- Platform Header -->
          <button
            class="flex items-center justify-between cursor-pointer hover:bg-base-200 p-3 rounded-lg"
            on:click={() => togglePlatform(platformGroup.platform.id)}
          >
            <div class="flex items-center gap-3">
              <span class="text-3xl">{getPlatformIcon(platformGroup.platform.platform)}</span>
              <div>
                <h2 class="card-title capitalize">{platformGroup.platform.platform}</h2>
                <p class="text-sm opacity-70">
                  {platformGroup.jobs.length} jobs •
                  {platformGroup.platform.isActive ? '🟢 Active' : '🔴 Inactive'} •
                  Last sync: {formatDate(platformGroup.platform.lastSync)}
                </p>
              </div>
            </div>
            <span class="text-2xl">{expandedPlatforms.has(platformGroup.platform.id) ? '▼' : '▶'}</span>
          </button>

          {#if expandedPlatforms.has(platformGroup.platform.id)}
            <div class="ml-8 mt-4 space-y-3">
              {#each platformGroup.jobs as jobData}
                <div class="card bg-base-200">
                  <div class="card-body p-4">
                    <!-- Job Header -->
                    <button
                      class="flex items-center justify-between cursor-pointer"
                      on:click={() => toggleJob(jobData.job.id)}
                    >
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <h3 class="font-bold text-lg">{jobData.job.title}</h3>
                          <span class="badge {getStatusBadge(jobData.job.status)}">{jobData.job.status}</span>
                        </div>
                        <p class="text-sm opacity-70">
                          {jobData.job.company} • {jobData.job.location || 'Remote'} •
                          First seen: {formatDate(jobData.job.firstSeenAt)}
                        </p>
                      </div>
                      <span class="text-xl">{expandedJobs.has(jobData.job.id) ? '▼' : '▶'}</span>
                    </button>

                    {#if expandedJobs.has(jobData.job.id)}
                      <div class="ml-4 mt-4 space-y-4">
                        {#if jobData.application}
                          <!-- Application Details -->
                          <div class="space-y-3">
                            <!-- Cover Letter -->
                            {#if jobData.application.coverLetter}
                              <div class="collapse collapse-arrow bg-base-100">
                                <input type="checkbox" />
                                <div class="collapse-title font-medium">
                                  📝 Cover Letter
                                </div>
                                <div class="collapse-content">
                                  <pre class="whitespace-pre-wrap text-sm">{jobData.application.coverLetter}</pre>
                                </div>
                              </div>
                            {/if}

                            <!-- Tailored Resume -->
                            {#if jobData.application.tailoredResume}
                              <div class="collapse collapse-arrow bg-base-100">
                                <input type="checkbox" />
                                <div class="collapse-title font-medium">
                                  📄 Tailored Resume
                                </div>
                                <div class="collapse-content">
                                  <pre class="whitespace-pre-wrap text-sm">{jobData.application.tailoredResume}</pre>
                                </div>
                              </div>
                            {/if}

                            <!-- Question Answers -->
                            {#if jobData.application.questionAnswers && jobData.application.questionAnswers.length > 0}
                              <div class="collapse collapse-arrow bg-base-100">
                                <input type="checkbox" />
                                <div class="collapse-title font-medium">
                                  ❓ Question Answers ({jobData.application.questionAnswers.length})
                                </div>
                                <div class="collapse-content">
                                  {#each jobData.application.questionAnswers as qa}
                                    <div class="mb-3">
                                      <p class="font-semibold">{qa.question}</p>
                                      <p class="text-sm opacity-70">{qa.answer}</p>
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}

                            <!-- API Calls -->
                            {#if jobData.application.apiCalls && jobData.application.apiCalls.length > 0}
                              <div class="card bg-base-100">
                                <div class="card-body p-3">
                                  <button
                                    class="flex items-center justify-between cursor-pointer"
                                    on:click={() => toggleApiCalls(jobData.job.id)}
                                  >
                                    <h4 class="font-medium">
                                      🔌 API Calls ({jobData.application.apiCalls.length})
                                    </h4>
                                    <span>{expandedApiCalls.has(`${jobData.job.id}_api`) ? '▼' : '▶'}</span>
                                  </button>

                                  {#if expandedApiCalls.has(`${jobData.job.id}_api`)}
                                    <div class="overflow-x-auto mt-2">
                                      <table class="table table-xs">
                                        <thead>
                                          <tr>
                                            <th>Time</th>
                                            <th>Endpoint</th>
                                            <th>AI Provider</th>
                                            <th>Input</th>
                                            <th>Output</th>
                                            <th>Total</th>
                                            <th>Cost</th>
                                            <th>Duration</th>
                                            <th>Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {#each jobData.application.apiCalls as call}
                                            <tr>
                                              <td>{formatDate(call.timestamp)}</td>
                                              <td><code class="text-xs">{call.endpoint}</code></td>
                                              <td><span class="badge badge-sm">{call.aiProvider}</span></td>
                                              <td>{call.inputTokens != null ? call.inputTokens.toLocaleString() : '—'}</td>
                                              <td>{call.outputTokens != null ? call.outputTokens.toLocaleString() : '—'}</td>
                                              <td>{call.tokensUsed != null ? call.tokensUsed.toLocaleString() : 'N/A'}</td>
                                              <td>{formatCost(call.cost || 0)}</td>
                                              <td>{call.processingTime}ms</td>
                                              <td>
                                                {#if call.response.success}
                                                  <span class="badge badge-success badge-sm">✓</span>
                                                {:else}
                                                  <span class="badge badge-error badge-sm">✗</span>
                                                {/if}
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

                            <!-- Automation Logs -->
                            {#if jobData.application.automationLogs && jobData.application.automationLogs.length > 0}
                              <div class="collapse collapse-arrow bg-base-100">
                                <input type="checkbox" />
                                <div class="collapse-title font-medium">
                                  🤖 Automation Logs ({jobData.application.automationLogs.length})
                                </div>
                                <div class="collapse-content">
                                  {#each jobData.application.automationLogs as log}
                                    <div class="flex items-start gap-2 mb-2">
                                      <span class="badge {log.success ? 'badge-success' : 'badge-error'} badge-sm">
                                        {log.success ? '✓' : '✗'}
                                      </span>
                                      <div class="flex-1">
                                        <p class="text-sm">{log.action}</p>
                                        <p class="text-xs opacity-60">{formatDate(log.timestamp)}</p>
                                        {#if log.message}
                                          <p class="text-xs opacity-70">{log.message}</p>
                                        {/if}
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}
                          </div>
                        {:else}
                          <div class="alert alert-warning">
                            <span>No application data yet. Waiting for bot to generate content.</span>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</main>
</AdminGuard>
