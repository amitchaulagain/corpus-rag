<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';
  import { jobAnalysisStore } from '$lib/job-analysis-store';

  import JobAnalysisResult from '$lib/components/JobAnalysisResult.svelte';

  // Reactive bindings to store
  $: analysisResult = $jobAnalysisStore.analysisResult;
  $: isGenerating = $jobAnalysisStore.isGenerating;

  // all variables
  let user = null;
  let jobs = [];
  let selectedJob = null;
  let jobContent = null;
  let isLoading = false;
  let analysisPrompt = '';

  let lastSavedPrompt = '';
  let initialLoaded = false;
  let isSidebarCollapsed = false;
  let isPromptExpanded = false;
  let isPromptModified = false;
  let defaultPrompt = '';
  let jobsWithSavedResponses = new Set();
  let isSavingPrompt = false;

  // Job editing variables
  let isEditingJob = false;
  let editedJobData = null;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }

    // Restore selected job from store
    if ($jobAnalysisStore.selectedJobFilename) {
      const job = jobs.find(j => j.filename === $jobAnalysisStore.selectedJobFilename);
      if (job) {
        await selectJob(job);
      }
    }

    // Load prompt from the server
    try {
      const response = await fetch('/api/prompts/job-analysis');
      const data = await response.json();
      analysisPrompt = data.content;
      lastSavedPrompt = data.content || '';
      isPromptModified = data.isModified || false;
      initialLoaded = true;

      // Load default prompt
      const defaultResponse = await fetch('/api/prompts/job-analysis?default=true');
      const defaultData = await defaultResponse.json();
      defaultPrompt = defaultData.content || '';
    } catch (error) {
      console.error('Failed to load prompt:', error);
      // Fallback to default if loading fails
      analysisPrompt = `You are an expert career coach and job market analyst. I will provide you with a job description and my resume. Your task is to conduct a comprehensive analysis of how well I match the position and provide actionable insights.

Instructions:
1. Analyze the job description thoroughly:
   - Job title and seniority level
   - Key responsibilities and day-to-day duties
   - Required skills (technical and soft skills)
   - Preferred qualifications
   - Company culture indicators
   - Growth opportunities mentioned
   - Compensation signals (if any)

2. Evaluate my resume against the job requirements:
   - Direct skill matches
   - Transferable skills and experiences
   - Gaps in qualifications
   - Overqualified areas
   - Relevant achievements and metrics
   - Cultural fit indicators

3. Provide a detailed analysis report including:

   **Overall Fit Score:** Rate 0-100 with justification

   **Strengths (What Makes Me a Great Fit):**
   - List 5-7 key strengths with specific examples from my resume
   - Connect each strength to specific job requirements
   - Highlight unique qualifications that set me apart

   **Gaps & Concerns:**
   - Required skills/experience I'm missing
   - Potential red flags from employer perspective
   - Areas where I may be underqualified

   **Transferable Skills & Experiences:**
   - Skills from other roles that apply here
   - How to frame unrelated experience as relevant
   - Hidden strengths the employer might miss

   **Interview Preparation:**
   - Top 5 questions they're likely to ask based on the job description
   - Key talking points to emphasize
   - Stories/examples to prepare (STAR format suggestions)
   - Potential concerns to proactively address

   **Application Strategy:**
   - Should I apply? (Yes/No with reasoning)
   - Priority level (High/Medium/Low)
   - How to position myself in application materials
   - Networking opportunities to leverage
   - Timeline considerations

   **Resume Optimization Suggestions:**
   - Top 3-5 specific changes to make
   - Keywords to incorporate
   - Achievements to highlight
   - How to address gaps

Be honest, specific, and actionable. Include concrete examples from both the job description and my resume to support all points.`;
    }
  });

  function onPromptChange() {
    isPromptModified = analysisPrompt !== lastSavedPrompt;
  }

  async function savePromptToFile() {
    if (analysisPrompt === lastSavedPrompt) {
      alert('No changes to save');
      return;
    }

    isSavingPrompt = true;
    try {
      const response = await fetch('/api/prompts/job-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: analysisPrompt })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = analysisPrompt;
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
      analysisPrompt = defaultPrompt;
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
        const response = await fetch(`/api/save-response?type=job-analysis&jobFilename=${encodeURIComponent(job.filename)}`);
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
    isEditingJob = false;

    // Clear analysis result in store when switching jobs
    if ($jobAnalysisStore.selectedJobFilename !== job.filename) {
      jobAnalysisStore.clearResults();
    }

    try {
      const response = await fetch(`/api/jobs/${job.filename}`);
      const data = await response.json();

      if (data.success) {
        jobContent = data.data.content;
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

  async function generateAnalysis() {
    if (!selectedJob || !jobContent) return;

    // Start analysis in store
    jobAnalysisStore.startAnalysis(selectedJob.filename);
    const abortSignal = jobAnalysisStore.getAbortSignal();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'job_analysis',
          jobDetails: jobContent,
          userEmail: user.email,
          customPrompt: analysisPrompt
        }),
        signal: abortSignal
      });

      const data = await response.json();

      if (data.success) {
        try {
          // The AI might wrap the JSON in code blocks, so we need to extract it
          const rawText = data.data.generatedText.trim();

          let jsonString = rawText;

          // Try multiple extraction patterns in order of specificity
          // 1. Try ```json ... ``` (non-greedy to get the full content)
          let match = rawText.match(/```json\s*([\s\S]*?)```/);
          if (match) {
            jsonString = match[1].trim();
          } else {
            // 2. Try generic ``` ... ``` (non-greedy)
            match = rawText.match(/```\s*([\s\S]*?)```/);
            if (match) {
              jsonString = match[1].trim();
            } else {
              // 3. Try to find JSON object boundaries (from first { to last })
              const startIdx = rawText.indexOf('{');
              const endIdx = rawText.lastIndexOf('}');
              if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                jsonString = rawText.substring(startIdx, endIdx + 1);
              }
            }
          }

          // Parse the JSON
          const result = JSON.parse(jsonString);

          // Legacy upload is disabled; original resume must be sourced from FinalBoss managed storage.

          // Check if resume fields were truncated (common AI issue)
          if (result.updated_resume && result.updated_resume.length < 100) {
            console.warn('Updated resume seems truncated, may need to increase max tokens');
          }

          // Set the result in the store
          jobAnalysisStore.setAnalysisResult(result);

          // Save the response
          await saveResponse(result);
        } catch (e) {
          console.error('Failed to parse analysis JSON:', e);
          console.error('Raw response:', data.data.generatedText);

          // Try to extract partial JSON for debugging
          const startIdx = data.data.generatedText.indexOf('{');
          const endIdx = data.data.generatedText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            const partialJson = data.data.generatedText.substring(startIdx, endIdx + 1);
            console.log('Attempted JSON extraction:', partialJson.substring(0, 500) + '...');
          }

          alert('The analysis result was not valid JSON or was truncated. The AI response may be too long. Please try again or check console for details.');
          // Show the error with raw text for debugging
          const errorResult = { error: 'Invalid JSON response', raw: data.data.generatedText };
          jobAnalysisStore.setAnalysisResult(errorResult);
        }
      } else {
        alert('Failed to generate analysis: ' + data.error);
        jobAnalysisStore.cancelAnalysis();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Analysis generation was cancelled');
      } else {
        console.error('Failed to generate analysis:', error);
        alert('Failed to generate analysis: ' + error.message);
      }
      jobAnalysisStore.cancelAnalysis();
    }
  }

  async function saveResponse(response) {
    if (!selectedJob) return;

    try {
      await fetch('/api/save-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'job-analysis',
          company: selectedJob.company,
          title: selectedJob.title,
          jobFilename: selectedJob.filename,
          response
        })
      });
      // Update the set to reflect this job now has a saved response
      jobsWithSavedResponses = new Set([...jobsWithSavedResponses, selectedJob.filename]);
    } catch (error) {
      console.error('Failed to save response:', error);
      // Don't show alert, just log - saving is a nice-to-have
    }
  }

  async function loadLastResponse() {
    if (!selectedJob) return;

    try {
      const response = await fetch(`/api/save-response?type=job-analysis&jobFilename=${encodeURIComponent(selectedJob.filename)}`);
      const data = await response.json();

      if (data.success && data.data) {
        jobAnalysisStore.setAnalysisResult(data.data.response);
      } else {
        alert('No saved analysis found for this job.');
      }
    } catch (error) {
      console.error('Failed to load saved response:', error);
      alert('Failed to load saved response: ' + error.message);
    }
  }

  function cancelAnalysis() {
    jobAnalysisStore.cancelAnalysis();
  }

  function clearResults() {
    jobAnalysisStore.clearResults();
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🎯 Job Analysis</h1>
    <p class="text-base-content/70">Analyze job requirements and assess your resume fit</p>

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
              bind:textContent={analysisPrompt}
              on:input={onPromptChange}
            >{analysisPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={analysisPrompt}
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
    <!-- Jobs List -->
    <div class="jobs-sidebar" class:collapsed={isSidebarCollapsed}>
      <div class="sidebar-header">
        <h2 on:click={() => isSidebarCollapsed = !isSidebarCollapsed} style="cursor: pointer;">
          {#if isSidebarCollapsed}
            💼
          {:else}
            💼 Jobs with Descriptions
          {/if}
        </h2>
        {#if !isSidebarCollapsed}
          <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
            {#if isLoading}⏳{:else}🔄{/if}
          </button>
        {/if}
      </div>

      {#if !isSidebarCollapsed}
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
              >
                <div class="job-header">
                  <span class="job-type" on:click={() => selectJob(job)} style="cursor: pointer;">
                    {#if job.hasQuestions}
                      💼❓ Job + Q&A
                    {:else}
                      💼 Job Only
                    {/if}
                  </span>
                  <div class="job-header-right">
                    <span class="job-size">{formatFileSize(job.size)}</span>
                    <button
                      class="quick-action-btn-inline"
                      on:click|stopPropagation={async () => {
                        await selectJob(job);
                        await generateAnalysis();
                      }}
                      disabled={isGenerating}
                    >
                      🎯
                    </button>
                  </div>
                </div>
                <div on:click={() => selectJob(job)} style="cursor: pointer;">
                  <h3 class="job-company">{job.company}</h3>
                  <p class="job-title">{job.title}</p>
                  {#if job.location}
                    <p class="job-location">📍 {job.location}</p>
                  {/if}
                  {#if job.hasQuestions}
                    <p class="job-questions">❓ {job.questionCount} questions</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- Collapsed view: Numbered list -->
        <div class="jobs-list-collapsed">
          {#each jobs as job, index}
            <button
              class="job-icon"
              class:selected={selectedJob?.filename === job.filename}
              on:click={() => selectJob(job)}
              title="{job.company} - {job.title}"
            >
              {index + 1}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Analysis Panel -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">📊</div>
          <h2>Select a job for analysis</h2>
          <p>Choose from the job descriptions on the left to start analyzing job requirements</p>
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
              on:click={generateAnalysis}
              disabled={isGenerating || !jobContent}
            >
              {#if isGenerating}
                ⏳ Analyzing...
              {:else}
                🎯 Analyze Job
              {/if}
            </button>
            {#if isGenerating}
              <button
                class="cancel-btn-alt"
                on:click={cancelAnalysis}
              >
                ⏹ Cancel
              </button>
            {/if}
            {#if selectedJob && jobsWithSavedResponses.has(selectedJob.filename)}
              <button
                class="load-btn"
                on:click={loadLastResponse}
                disabled={isGenerating}
              >
                📂 Load Saved
              </button>
            {/if}
            {#if analysisResult && !isGenerating}
              <button
                class="clear-btn"
                on:click={clearResults}
              >
                🗑 Clear
              </button>
            {/if}
          </div>
        </div>

        {#if jobContent}
          <div class="content-section">
            <!-- Generated Analysis -->
            {#if analysisResult}
              <JobAnalysisResult {analysisResult} {user} />
            {/if}

            <!-- Job Description -->
            <div class="job-description-section" style="margin-top: 2rem;">
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

  .cancel-btn-alt {
    background: #ffc107;
    color: #000;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
    font-weight: 600;
  }

  .cancel-btn-alt:hover {
    background: #e0a800;
  }

  .clear-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .clear-btn:hover {
    background: #c82333;
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

  /* Responsive */
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
