<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  // all variables
  let user = null;
  let jobs = [];
  let selectedJob = null;
  let jobContent = null;
  let isLoading = false;
  let isGenerating = false;
  let generatedCoverLetter = '';
  let coverLetterPrompt = '';

  let lastSavedPrompt = '';
  let initialLoaded = false;
  let isSidebarCollapsed = false;
  let isPromptExpanded = false;
  let isPromptModified = false;
  let defaultPrompt = '';
  let jobsWithSavedResponses = new Set();
  let isSavingPrompt = false;

  // Comparison mode variables
  let isComparing = false;
  let comparisonResults = null;
  let providers = [];

  // Job editing variables
  let isEditingJob = false;
  let editedJobData = null;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }

    // Load prompt from the server
    try {
      const response = await fetch('/api/prompts/cover-letter');
      const data = await response.json();
      coverLetterPrompt = data.content;
      lastSavedPrompt = data.content || '';
      isPromptModified = data.isModified || false;
      initialLoaded = true;

      // Load default prompt
      const defaultResponse = await fetch('/api/prompts/cover-letter?default=true');
      const defaultData = await defaultResponse.json();
      defaultPrompt = defaultData.content;
    } catch (error) {
      console.error('Failed to load prompt:', error);
      // Fallback to default if loading fails
      coverLetterPrompt = `You are an expert cover letter writer. I will provide you with a job description and my resume. Your task is to write a compelling, personalized cover letter that demonstrates why I'm the perfect fit for this role.

Instructions:
1. Carefully analyze the job description to identify:
   - Key responsibilities and requirements
   - Skills and qualifications they're looking for
   - Company values and culture (if mentioned)
   - Pain points they're trying to solve

2. Review my resume to find:
   - Relevant experiences that match their needs
   - Specific achievements with quantifiable results
   - Skills that align with the job requirements
   - Unique qualities that set me apart

3. Write a professional cover letter that:
   - Opens with a strong hook that captures attention
   - Shows genuine enthusiasm for the role and company
   - Highlights 2-3 most relevant achievements with specific examples
   - Demonstrates understanding of their challenges and how I can solve them
   - Uses action verbs and confident language
   - Maintains a professional yet personable tone
   - Keeps it concise (250-350 words)
   - Closes with a clear call to action

4. Format:
   - Professional greeting (use hiring manager name if available, otherwise "Dear Hiring Manager")
   - 3-4 well-structured paragraphs
   - Professional closing with my name

Make it authentic, confident, and tailored specifically to this role. Avoid generic phrases and clichés.`;
    }

    // Load providers for comparison
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      if (data.success) {
        providers = data.providers.filter((p) => p.enabled && p.hasApiKey);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  });

  function onPromptChange() {
    isPromptModified = coverLetterPrompt !== lastSavedPrompt;
  }

  async function savePromptToFile() {
    if (coverLetterPrompt === lastSavedPrompt) {
      alert('No changes to save');
      return;
    }

    isSavingPrompt = true;
    try {
      const response = await fetch('/api/prompts/cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: coverLetterPrompt })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = coverLetterPrompt;
        isPromptModified = false;
        alert('✅ Prompt saved to file');
      } else {
        alert('❌ Failed to save prompt');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('❌ Failed to save prompt');
    } finally {
      isSavingPrompt = false;
    }
  }

  async function resetPrompt() {
    if (confirm('Reset prompt to default? This will overwrite your current prompt.')) {
      coverLetterPrompt = defaultPrompt;
      await savePromptToFile();
    }
  }

  async function loadJobs() {
    if (!user) return;

    isLoading = true;
    try {
      const response = await fetch('/api/jobs');
      const data = await response.json();

      if (data.success) {
        // Filter to only jobs with descriptions (for cover letters)
        jobs = (data.data.jobs || []).filter(job => job.hasJobDetails);

        // Check which jobs have saved responses
        await checkSavedResponses();

        // Auto-load first job
        if (jobs.length > 0 && !selectedJob) {
          await selectJob(jobs[0]);
        }
      } else {
        alert('Failed to load jobs: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
      alert('Failed to load jobs: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  async function checkSavedResponses() {
    const newSet = new Set();
    for (const job of jobs) {
      try {
        const response = await fetch(`/api/save-response?type=cover-letter&jobFilename=${encodeURIComponent(job.filename)}`);
        const data = await response.json();
        if (data.success && data.data) {
          newSet.add(job.filename);
        }
      } catch (error) {
        // Ignore errors, just don't add to set
      }
    }
    jobsWithSavedResponses = newSet;
  }

  async function selectJob(job) {
    if (job.type === 'error') return;

    selectedJob = job;
    jobContent = null;
    generatedCoverLetter = '';
    comparisonResults = null;
    isEditingJob = false;

    try {
      const response = await fetch(`/api/jobs/${job.filename}`);
      const data = await response.json();

      if (data.success) {
        jobContent = data.data.content;
        // Auto-load saved comparison results
        await loadLastResponse();
      } else {
        alert('Failed to load job details: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to load job details:', error);
      alert('Failed to load job details: ' + error.message);
    }
  }

  // Job editing functions
  function startEditingJob() {
    isEditingJob = true;
    if (jobContent) {
      editedJobData = JSON.parse(JSON.stringify(jobContent));
    }
  }

  function cancelEditingJob() {
    isEditingJob = false;
    editedJobData = null;
  }

  function saveEditedJob() {
    if (editedJobData) {
      jobContent = JSON.parse(JSON.stringify(editedJobData));
    }
    isEditingJob = false;
    editedJobData = null;
    alert('✅ Job description updated for this session');
  }
  
  // Helper function to check if a value is a nested object
  function isNestedObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  
  // Helper function to get display label for field names
  function getFieldLabel(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Helper function to check if a field should be readonly
  function isReadonlyField(key) {
    const readonlyFields = [
      'jobId', 'jobid', 'job_id',
      'createdAt', 'createdat', 'created_at',
      'lastModified', 'lastmodified', 'last_modified', 'updatedAt', 'updatedat', 'updated_at',
      'size',
      'scrapedAt', 'scrapedat', 'scraped_at'
    ];
    return readonlyFields.includes(key.toLowerCase()) || key.toLowerCase().startsWith('custom_');
  }


  async function compareCoverLetters() {
    if (!selectedJob || !jobContent) return;

    isComparing = true;
    comparisonResults = null;

    try {
      const response = await fetch('/api/cover-letter/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.email,
          prompt: coverLetterPrompt,
          jobDescription: jobContent.description || jobContent.text || JSON.stringify(jobContent)
        })
      });

      const data = await response.json();

      if (data.success) {
        comparisonResults = data.results;
        // Auto-save the comparison results
        await saveComparisonResults(data.results);
      } else {
        alert('Failed to compare: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to compare cover letters:', error);
      alert('Failed to compare: ' + error.message);
    } finally {
      isComparing = false;
    }
  }

  async function saveComparisonResults(results) {
    if (!selectedJob) return;

    try {
      await fetch('/api/save-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'cover-letter-comparison',
          company: selectedJob.company,
          title: selectedJob.title,
          jobFilename: selectedJob.filename,
          response: JSON.stringify(results),
          userEmail: user.email
        })
      });
      jobsWithSavedResponses.add(selectedJob.filename);
    } catch (error) {
      console.error('Failed to save comparison results:', error);
    }
  }

  async function loadLastResponse() {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `/api/save-response?type=cover-letter-comparison&jobFilename=${selectedJob.filename}`
      );
      const data = await response.json();

      if (data.success && data.data && data.data.response) {
        // The response is already JSON stringified, so parse it
        comparisonResults = JSON.parse(data.data.response);
        generatedCoverLetter = ''; // Clear old single response
      }
      // Silently fail if no saved response - don't alert the user
    } catch (error) {
      // Silently fail - it's okay if there's no saved response
      console.log('No saved response for this job');
    }
  }

  function getProviderName(id) {
    const provider = providers.find((p) => p.id === id);
    return provider?.name || id;
  }

  function getProviderIcon(id) {
    if (id.includes('claude')) return '🟣';
    if (id.includes('deepseek')) return '🔵';
    if (id.includes('gemini')) return '🟢';
    return '🤖';
  }

  function formatTime(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  function formatCurrency(value, currency) {
    if (value === 0 && currency === 'USD') return 'FREE';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      }).format(value);
    } catch (e) {
      return `${currency} ${value.toFixed(4)}`;
    }
  }


  function formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">✍️ Cover Letters</h1>
    <p class="text-base-content/70">Generate AI-powered cover letters for job applications</p>

    <!-- Always Visible Prompt Section -->
    <div class="prompt-section">
      <div class="prompt-header">
        <h3 on:click={() => isPromptExpanded = !isPromptExpanded} style="cursor: pointer;">
          🤖 AI Prompt Editor
        </h3>
        {#if isPromptModified}
          <div class="prompt-actions">
            <button class="save-btn-small" on:click={savePromptToFile} disabled={isSavingPrompt} title="Save to file">
              {#if isSavingPrompt}💾 Saving...{:else}💾 Save{/if}
            </button>
            <button class="reset-btn-small" on:click={resetPrompt} title="Reset to default">
              ↺ Reset
            </button>
          </div>
        {/if}
      </div>
      <div class="prompt-container">
        <div class="prompt-area">
          {#if isPromptExpanded}
            <pre
              class="prompt-display"
              contenteditable="true"
              bind:textContent={coverLetterPrompt}
              on:input={onPromptChange}
            >{coverLetterPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={coverLetterPrompt}
              placeholder="Enter your AI prompt here..."
              rows="10"
              on:input={onPromptChange}
            ></textarea>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="main-content">
    <!-- Jobs List - Horizontal -->
    <div class="jobs-sidebar">
      <div class="sidebar-header">
        <h2>💼 Jobs with Descriptions</h2>
        <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
          {#if isLoading}⏳{:else}🔄{/if}
        </button>
      </div>

      {#if isLoading}
        <div class="loading">Loading jobs...</div>
      {:else if jobs.length === 0}
        <div class="empty-state">
          <p>No job descriptions found</p>
          <small>Only jobs with detailed descriptions can generate cover letters</small>
        </div>
      {:else}
        <div class="jobs-list">
          {#each jobs as job}
            <div
              class="job-item"
              class:selected={selectedJob?.filename === job.filename}
              class:has-saved={jobsWithSavedResponses.has(job.filename)}
              on:click={() => selectJob(job)}
            >
              <div class="job-header">
                <span class="job-type">
                  {#if job.hasQuestions}
                    💼❓
                  {:else}
                    💼
                  {/if}
                </span>
                <div class="job-header-right">
                  <span class="job-size">{formatFileSize(job.size)}</span>
                </div>
              </div>
              <div>
                <h3 class="job-company">{job.company}</h3>
                <p class="job-title">{job.title}</p>
                {#if job.location}
                  <p class="job-location">📍 {job.location}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Cover Letter Generation -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">✍️</div>
          <h2>Select a job to generate cover letter</h2>
          <p>Choose from the job descriptions on the left to start generating a personalized cover letter</p>
        </div>
      {:else}
        <div class="job-header-section">
          <div class="job-info">
            <h2>{selectedJob.company}</h2>
            <h3>{selectedJob.title}</h3>
            {#if selectedJob.location}
              <p class="location">📍 {selectedJob.location}</p>
            {/if}
          </div>

          <div class="generate-section">
            <button
              class="generate-btn"
              on:click={compareCoverLetters}
              disabled={isComparing || !jobContent || providers.length === 0}
              style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"
            >
              {#if isComparing}
                ⏳ Comparing...
              {:else}
                🔍 Compare All AIs
              {/if}
            </button>
          </div>
        </div>

        {#if jobContent}
          <div class="content-section">
            <!-- Generated Cover Letter -->
            {#if generatedCoverLetter}
              <div class="cover-letter-section">
                <div class="section-header">
                  <h3>📝 Your Cover Letter</h3>
                  <div class="actions">
                    <button class="copy-btn" on:click={() => copyToClipboard(generatedCoverLetter)}>
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div class="generated-content">
                  <pre class="cover-letter-text">{generatedCoverLetter}</pre>
                </div>
              </div>
            {/if}

            <!-- Comparison Results -->
            {#if comparisonResults}
              <div class="comparison-section" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1.5rem; font-size: 1.5rem;">🔍 AI Comparison Results</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                  {#each Object.entries(comparisonResults).filter(([providerId]) => providers.some(p => p.id === providerId)) as [providerId, result]}
                    <div style="background: rgba(128, 128, 128, 0.1); border: 2px solid {result.success ? 'green' : 'red'}; border-radius: 8px; padding: 1.5rem;">
                      <!-- Provider Header -->
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0; font-size: 1.1rem;">
                          {getProviderIcon(providerId)} {getProviderName(providerId)}
                        </h4>
                        {#if result.success}
                          <span style="background: green; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem;">Success</span>
                        {:else}
                          <span style="background: red; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem;">Failed</span>
                        {/if}
                      </div>

                      <!-- Answer -->
                      {#if result.success && result.answer}
                        <div style="margin-bottom: 1rem;">
                          <pre style="white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.6; font-size: 0.95rem; margin: 0;">{result.answer}</pre>
                        </div>
                        <button
                          class="copy-btn"
                          on:click={() => copyToClipboard(result.answer)}
                          style="width: 100%; margin-bottom: 1rem;"
                        >
                          📋 Copy
                        </button>
                      {:else if result.error}
                        <div style="background: rgba(255, 0, 0, 0.1); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                          <span style="font-size: 0.9rem;">{result.error}</span>
                        </div>
                      {/if}

                      <!-- Metadata -->
                      <div style="border-top: 1px solid rgba(128, 128, 128, 0.3); padding-top: 1rem;">
                        {#if result.metadata}
                          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem; opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between;">
                              <span>⏱️ Time:</span>
                              <span style="font-weight: 600;">{formatTime(result.metadata.processingTime)}</span>
                            </div>
                            {#if result.metadata.tokensUsed}
                              <div style="display: flex; justify-content: space-between;">
                                <span>🎯 Tokens:</span>
                                <span style="font-weight: 600;">{result.metadata.tokensUsed.toLocaleString()}</span>
                              </div>
                            {/if}
                            <div style="display: flex; justify-content: space-between;">
                              <span>🤖 Model:</span>
                              <span style="font-family: monospace; font-size: 0.75rem;">{result.metadata.model}</span>
                            </div>
                            {#if result.metadata.cost}
                              <div style="border-top: 1px solid rgba(128, 128, 128, 0.2); padding-top: 0.5rem; margin-top: 0.5rem;">
                                <div style="display: flex; justify-content: space-between;">
                                  <span>💰 Cost:</span>
                                  <div style="text-align: right; font-weight: 600;">
                                    <div>{formatCurrency(result.metadata.cost.usd, 'USD')}</div>
                                    <div style="opacity: 0.7; font-size: 0.8rem;">{formatCurrency(result.metadata.cost.aud, 'AUD')}</div>
                                    <div style="opacity: 0.7; font-size: 0.8rem;">{formatCurrency(result.metadata.cost.npr, 'NPR')}</div>
                                  </div>
                                </div>
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Job Description -->
            <div class="job-description-section">
              <div class="job-details-card">
                <div class="job-meta">
                  <span class="meta-item">📝 Job Description</span>
                  {#if !isEditingJob}
                    <button class="edit-btn" on:click={startEditingJob}>
                      ✏️ Edit
                    </button>
                  {:else}
                    <div class="edit-actions">
                      <button class="save-btn" on:click={saveEditedJob}>
                        ✅ Save
                      </button>
                      <button class="cancel-btn" on:click={cancelEditingJob}>
                        ❌ Cancel
                      </button>
                    </div>
                  {/if}
                </div>
                <div class="job-description-content">
                  {#if isEditingJob && editedJobData}
                    <div class="dynamic-form">
                      {#each Object.keys(editedJobData) as key}
                        {#if !isNestedObject(editedJobData[key])}
                          <div class="form-field">
                            <label for="job-{key}">
                              {getFieldLabel(key)}
                              {#if key === 'details' || key === 'description'}
                                <span class="field-badge">Main Content</span>
                              {:else if isReadonlyField(key)}
                                <span class="field-badge readonly">Readonly</span>
                              {/if}
                            </label>
                            {#if key === 'details' || key === 'description'}
                              <textarea
                                id="job-{key}"
                                bind:value={editedJobData[key]}
                                rows="12"
                                class="form-textarea large"
                              ></textarea>
                            {:else if typeof editedJobData[key] === 'boolean'}
                              <label class="checkbox-label">
                                <input
                                  type="checkbox"
                                  id="job-{key}"
                                  bind:checked={editedJobData[key]}
                                  disabled={isReadonlyField(key)}
                                />
                                <span>Enabled</span>
                              </label>
                            {:else if typeof editedJobData[key] === 'number'}
                              <input
                                type="number"
                                id="job-{key}"
                                bind:value={editedJobData[key]}
                                class="form-input"
                                class:readonly={isReadonlyField(key)}
                                readonly={isReadonlyField(key)}
                              />
                            {:else}
                              <input
                                type="text"
                                id="job-{key}"
                                bind:value={editedJobData[key]}
                                class="form-input"
                                class:readonly={isReadonlyField(key)}
                                readonly={isReadonlyField(key)}
                              />
                            {/if}
                          </div>
                        {:else}
                          <div class="form-field nested">
                            <div class="nested-label">
                              {getFieldLabel(key)}
                              <span class="field-badge">Object</span>
                            </div>
                            <div class="nested-object">
                              {#each Object.keys(editedJobData[key]) as nestedKey}
                                <div class="nested-field">
                                  <label for="job-{key}-{nestedKey}" class="nested-field-label">
                                    {getFieldLabel(nestedKey)}
                                    {#if isReadonlyField(nestedKey)}
                                      <span class="field-badge readonly small">Readonly</span>
                                    {/if}
                                  </label>
                                  {#if typeof editedJobData[key][nestedKey] === 'boolean'}
                                    <label class="checkbox-label">
                                      <input
                                        type="checkbox"
                                        id="job-{key}-{nestedKey}"
                                        bind:checked={editedJobData[key][nestedKey]}
                                        disabled={isReadonlyField(nestedKey)}
                                      />
                                      <span>Enabled</span>
                                    </label>
                                  {:else if typeof editedJobData[key][nestedKey] === 'number'}
                                    <input
                                      type="number"
                                      id="job-{key}-{nestedKey}"
                                      bind:value={editedJobData[key][nestedKey]}
                                      class="form-input nested"
                                      class:readonly={isReadonlyField(nestedKey)}
                                      readonly={isReadonlyField(nestedKey)}
                                    />
                                  {:else}
                                    <input
                                      type="text"
                                      id="job-{key}-{nestedKey}"
                                      bind:value={editedJobData[key][nestedKey]}
                                      class="form-input nested"
                                      class:readonly={isReadonlyField(nestedKey)}
                                      readonly={isReadonlyField(nestedKey)}
                                    />
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                    <div class="edit-hint">
                      💡 <strong>Tip:</strong> Edit fields directly in the form. Changes apply to this session only (not saved to file).
                    </div>
                  {:else}
                    <div class="job-details">
                      <h4>📋 Job Details</h4>
                      <pre class="job-text">{jobContent.details || 'No details available'}</pre>
                    </div>
                  {/if}
                  {#if jobContent.questions && jobContent.questions.length > 0}
                    <div class="job-questions-preview">
                      <h4>❓ Screening Questions ({jobContent.questions.length})</h4>
                      <ul class="questions-list">
                        {#each jobContent.questions as question, index}
                          <li class="question-preview">
                            <strong>Q{index + 1}:</strong> {question.q}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if jobContent.url}
                    <div class="job-link">
                      <a href={jobContent.url} target="_blank" rel="noopener noreferrer">
                        🔗 View Original Job Posting
                      </a>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="loading">Loading job details...</div>
        {/if}
      {/if}
    </div>
  </div>
</main>

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }

  /* Page-specific buttons */
  .generate-btn, .load-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #218838;
  }

  .generate-btn:disabled, .load-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .quick-action-btn-inline {
    padding: 4px 10px;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
    margin-left: 8px;
  }

  .quick-action-btn-inline:hover:not(:disabled) {
    background: #ee5a52;
  }

  .quick-action-btn-inline:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Prompt Editor Styles */
  .prompt-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .save-btn-small {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .save-btn-small:hover:not(:disabled) {
    background: #218838;
    transform: translateY(-1px);
  }

  .save-btn-small:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .prompt-hint {
    padding: 10px 15px;
    background: rgba(102, 126, 234, 0.1);
    border-left: 4px solid #667eea;
    margin-top: 10px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: inherit;
  }

  /* Responsive */
  /* Dynamic Form Styles */
  .dynamic-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 10px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field label {
    font-weight: 600;
    font-size: 0.95rem;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .field-badge.readonly {
    background: rgba(128, 128, 128, 0.2);
    color: #666;
  }

  .field-badge.small {
    font-size: 0.65rem;
    padding: 1px 6px;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .form-input.readonly,
  .form-input:read-only {
    background: rgba(128, 128, 128, 0.1);
    color: #666;
    cursor: not-allowed;
    border-color: rgba(128, 128, 128, 0.2);
  }

  .form-input.readonly:focus,
  .form-input:read-only:focus {
    border-color: rgba(128, 128, 128, 0.3);
    box-shadow: none;
  }

  .form-textarea {
    width: 100%;
    padding: 12px 15px;
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: 'Monaco', 'Courier New', monospace;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-textarea.large {
    min-height: 200px;
  }

  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .form-field.nested {
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    padding: 15px;
  }

  .nested-label {
    font-size: 1rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 10px;
  }

  .nested-object {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .nested-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nested-field-label {
    font-weight: 500;
    font-size: 0.85rem;
    color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .form-input.nested {
    font-size: 0.85rem;
    padding: 8px 10px;
  }

  .dynamic-form::-webkit-scrollbar {
    width: 8px;
  }

  .dynamic-form::-webkit-scrollbar-track {
    background: rgba(128, 128, 128, 0.1);
    border-radius: 4px;
  }

  .dynamic-form::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.5);
    border-radius: 4px;
  }

  .dynamic-form::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 126, 234, 0.7);
  }

  .edit-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .edit-btn:hover {
    background: #5568d3;
    transform: translateY(-1px);
  }

  .edit-actions {
    display: flex;
    gap: 10px;
  }

  .save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .save-btn:hover {
    background: #218838;
    transform: translateY(-1px);
  }

  .cancel-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    background: #c82333;
    transform: translateY(-1px);
  }

  .edit-hint {
    padding: 12px 18px;
    background: rgba(102, 126, 234, 0.1);
    border-left: 4px solid #667eea;
    margin-top: 10px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: inherit;
  }

  @media (max-width: 768px) {
    .main-content {
      grid-template-columns: 1fr;
    }

    .jobs-sidebar {
      display: none;
    }

    .job-header-section {
      flex-direction: column;
      gap: 15px;
    }

    .container {
      padding: 15px;
    }
  }
</style>
</AdminGuard>
