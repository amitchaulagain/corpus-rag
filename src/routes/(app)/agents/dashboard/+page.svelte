<!-- Agent Dashboard -->
<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let agentProfile: any = null;
  let applications: any[] = [];
  let charges: any = null;
  let jobSeekers: any[] = [];
  let isLoading = false;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      const currentUser = JSON.parse(storedUser);
      if (!currentUser.roles?.includes('agent')) {
        alert('Access denied - Agent access required');
        window.location.href = '/agents/register';
        return;
      }
    } else {
      alert('Please log in');
      window.location.href = '/';
      return;
    }

    await Promise.all([loadAgentProfile(), loadApplications(), loadCharges(), loadJobSeekers()]);
  });

  async function loadAgentProfile() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agents/register', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          agentProfile = data.agent;
        }
      } else if (response.status === 404) {
        // Not registered yet
        window.location.href = '/agents/register';
      }
    } catch (error) {
      console.error('Failed to load agent profile:', error);
    }
  }

  async function loadApplications() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agent/applications', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          applications = data.applications;
        }
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  }

  async function loadCharges() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agents/charges', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          charges = data.summary;
        }
      }
    } catch (error) {
      console.error('Failed to load charges:', error);
    }
  }

  async function loadJobSeekers() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agents/job-seekers', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          jobSeekers = data.jobSeekers;
        }
      }
    } catch (error) {
      console.error('Failed to load job seekers:', error);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">🤝 Agent Dashboard</h1>
      <p class="text-base-content/70">Manage your agency and applications</p>
    </div>
    <div class="flex gap-2">
      <a href="/agents/register" class="btn btn-ghost">⚙️ Edit Profile</a>
      <a href="/dashboard" class="btn btn-ghost">← Dashboard</a>
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <!-- Agent Profile Card -->
    {#if agentProfile}
      <div class="card bg-base-100 shadow-xl mb-6">
        <div class="card-body">
          <h2 class="card-title mb-4">Agency Profile</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-base-content/70">Agency Name</p>
              <p class="font-semibold">{agentProfile.agencyName}</p>
            </div>
            <div>
              <p class="text-sm text-base-content/70">Billing Method</p>
              <p class="font-semibold capitalize">{agentProfile.billingMethod}</p>
            </div>
            <div>
              <p class="text-sm text-base-content/70">Commission Rate</p>
              <p class="font-semibold">{agentProfile.commissionRate}%</p>
            </div>
            {#if agentProfile.fixedFee > 0}
              <div>
                <p class="text-sm text-base-content/70">Fixed Fee</p>
                <p class="font-semibold">{agentProfile.fixedFee} tokens</p>
              </div>
            {/if}
            <div>
              <p class="text-sm text-base-content/70">Status</p>
              {#if agentProfile.isActive}
                <span class="badge badge-success">Active</span>
              {:else}
                <span class="badge badge-error">Inactive</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Statistics -->
    {#if charges}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Total Earnings</div>
          <div class="stat-value text-primary">{charges.totalCharges.toFixed(2)}</div>
          <div class="stat-desc">tokens</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Total Applications</div>
          <div class="stat-value text-secondary">{charges.totalApplications}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Charged</div>
          <div class="stat-value text-accent">{charges.chargedApplications}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Pending</div>
          <div class="stat-value text-warning">{charges.pendingApplications}</div>
        </div>
      </div>
    {/if}

    <!-- Job Seekers -->
    <div class="card bg-base-100 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title mb-4">Linked Job Seekers ({jobSeekers.length})</h2>
        {#if jobSeekers.length > 0}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Contract Terms</th>
                </tr>
              </thead>
              <tbody>
                {#each jobSeekers as js}
                  <tr>
                    <td>{js.jobSeeker.name}</td>
                    <td>{js.jobSeeker.email}</td>
                    <td>
                      <span class="badge badge-success">{js.status}</span>
                    </td>
                    <td>
                      {#if js.contractTerms}
                        <div class="text-sm">
                          {#if js.contractTerms.commissionRate}
                            <p>Rate: {js.contractTerms.commissionRate}%</p>
                          {/if}
                          {#if js.contractTerms.fixedFee}
                            <p>Fee: {js.contractTerms.fixedFee} tokens</p>
                          {/if}
                        </div>
                      {:else}
                        <span class="text-base-content/50">Default terms</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-base-content/70">No job seekers linked yet.</p>
        {/if}
      </div>
    </div>

    <!-- Recent Applications -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Recent Applications ({applications.length})</h2>
        {#if applications.length > 0}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job ID</th>
                  <th>Job Seeker</th>
                  <th>Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each applications.slice(0, 10) as app}
                  <tr>
                    <td>{formatDate(app.submittedAt)}</td>
                    <td><code class="text-xs">{app.jobId}</code></td>
                    <td><code class="text-xs">{app.jobSeekerId}</code></td>
                    <td>
                      <span class="badge badge-primary">
                        {app.charges.amount.toFixed(2)} tokens
                      </span>
                      <span class="badge badge-{app.charges.status === 'charged' ? 'success' : 'warning'} ml-1">
                        {app.charges.status}
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-outline">{app.status}</span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-base-content/70">No applications submitted yet.</p>
        {/if}
      </div>
    </div>
  {/if}
</main>
