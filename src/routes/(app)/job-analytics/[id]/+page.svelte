<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let app: any = null;
  let isLoading = true;
  let error = '';

  const id = $page.params.id;

  onMount(() => {
    loadDetail();
  });

  async function loadDetail() {
    if (!id) {
      error = 'Invalid ID';
      isLoading = false;
      return;
    }
    isLoading = true;
    error = '';
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/job-applications/${id}`, { headers });

      if (response.status === 404) {
        error = 'Application not found';
        app = null;
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        app = data.data;
      } else {
        app = null;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load application';
      app = null;
    } finally {
      isLoading = false;
    }
  }

  function formatDate(d: string | Date | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<svelte:head>
  <title>{app ? `${app.title} – ${app.company}` : 'Job Application'} – Job Analytics</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
  <div class="mb-4">
    <button type="button" class="btn btn-ghost btn-sm" on:click={() => goto('/job-analytics')}>← Back to list</button>
  </div>

  {#if isLoading}
    <div class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
      <button type="button" class="btn btn-ghost btn-sm" on:click={loadDetail}>Retry</button>
    </div>
  {:else if app}
    <div class="flex flex-col gap-6">
      <!-- Job header -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h1 class="card-title text-xl">{app.title}</h1>
          <p class="text-lg text-base-content/80">{app.company}</p>
          <div class="flex flex-wrap gap-2 text-sm text-base-content/70">
            {#if app.location}<span>{app.location}</span>{/if}
            {#if app.jobType}<span>• {app.jobType}</span>{/if}
            {#if app.salary}<span>• {app.salary}</span>{/if}
          </div>
          {#if app.url}
            <a href={app.url} target="_blank" rel="noopener noreferrer" class="link link-primary text-sm">Open job posting</a>
          {/if}
          <p class="text-xs text-base-content/50">Recorded: {formatDate(app.lastUpdatedAt)}</p>
        </div>
      </div>

      <!-- Job description -->
      {#if app.description}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">Job description</h2>
            <div class="prose prose-sm max-w-none whitespace-pre-wrap">{app.description}</div>
          </div>
        </div>
      {/if}

      <!-- Cover letter -->
      {#if app.application?.coverLetter}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">Cover letter</h2>
            <div class="prose prose-sm max-w-none whitespace-pre-wrap">{app.application.coverLetter}</div>
          </div>
        </div>
      {/if}

      <!-- Resume ref -->
      {#if app.application?.tailoredResume}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">Resume</h2>
            <p class="text-sm text-base-content/70">{app.application.tailoredResume}</p>
          </div>
        </div>
      {/if}

      <!-- Questions & answers -->
      {#if app.application?.questionAnswers && app.application.questionAnswers.length > 0}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">Questions & answers</h2>
            <ul class="space-y-4">
              {#each app.application.questionAnswers as qa}
                <li class="border-l-2 border-base-300 pl-4">
                  <p class="font-medium text-sm">{qa.question}</p>
                  <p class="text-sm text-base-content/80">{qa.answer}</p>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}

      <!-- Raw / source (optional) -->
      {#if app.rawData?.source}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">Source</h2>
            <p class="text-xs font-mono text-base-content/60">{JSON.stringify(app.rawData.source)}</p>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <p class="text-base-content/70">No data to display.</p>
  {/if}
</div>
