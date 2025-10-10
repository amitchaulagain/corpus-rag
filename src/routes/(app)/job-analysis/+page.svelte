<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  import JobAnalysisResult from '$lib/components/JobAnalysisResult.svelte';

  // all variables
  let user = null;
  let jobs = [];
  let selectedJob = null;
  let jobContent = null;
  let isLoading = false;
  let isGenerating = false;
  let analysisResult = null;
  let analysisPrompt = '';

  let lastSavedPrompt = '';
  let initialLoaded = false;
  let isSidebarCollapsed = false;
  let isPromptExpanded = false;
  let isPromptModified = false;
  let defaultPrompt = '';
  let jobsWithSavedResponses = new Set();

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
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

  async function savePrompt(content) {
    // Only save if content has actually changed
    if (content === lastSavedPrompt) {
      return;
    }

    try {
      const response = await fetch('/api/prompts/job-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = content;
        isPromptModified = content !== defaultPrompt;
        console.log('Prompt saved successfully');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  async function resetPrompt() {
    if (confirm('Reset prompt to default? This will overwrite your current prompt.')) {
      analysisPrompt = defaultPrompt;
      await savePrompt(defaultPrompt);
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
    analysisResult = null;

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

  async function generateAnalysis() {
    if (!selectedJob || !jobContent) return;

    isGenerating = true;
    analysisResult = null;
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
        })
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
          analysisResult = JSON.parse(jsonString);

          // Fetch original resume from local storage
          try {
            const storageResponse = await fetch(`/api/upload?userId=${encodeURIComponent(user.email)}`);
            const storageData = await storageResponse.json();

            if (storageData.success && storageData.files) {
              const resumeFile = storageData.files.find(f =>
                f.name === 'resume.txt' || f.name.includes('resume')
              );

              if (resumeFile) {
                // Fetch the resume content
                const resumeResponse = await fetch(`/api/upload?userId=${encodeURIComponent(user.email)}&filename=${resumeFile.name}`);
                const resumeData = await resumeResponse.json();

                if (resumeData.success && resumeData.content) {
                  analysisResult.original_resume = resumeData.content;
                } else {
                  console.error('Resume data missing content:', resumeData);
                }
              } else {
                console.warn('No resume.txt found in storage');
              }
            } else {
              console.warn('Storage list failed or no files:', storageData);
            }
          } catch (e) {
            console.error('Failed to fetch original resume from cloud storage:', e);
          }

          // Check if resume fields were truncated (common AI issue)
          if (analysisResult.updated_resume && analysisResult.updated_resume.length < 100) {
            console.warn('Updated resume seems truncated, may need to increase max tokens');
          }

          // Save the response
          await saveResponse(analysisResult);
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
          analysisResult = { error: 'Invalid JSON response', raw: data.data.generatedText };
        }
      } else {
        alert('Failed to generate analysis: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      alert('Failed to generate analysis: ' + error.message);
    } finally {
      isGenerating = false;
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
        analysisResult = data.data.response;
      } else {
        alert('No saved analysis found for this job.');
      }
    } catch (error) {
      console.error('Failed to load saved response:', error);
      alert('Failed to load saved response: ' + error.message);
    }
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
<main class="container mx-auto max-w-6xl p-6">
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
          <button class="reset-btn-small" on:click={resetPrompt} title="Reset to default">
            ↺ Reset
          </button>
        {/if}
      </div>
      <div class="prompt-container">
        <div class="prompt-area">
          {#if isPromptExpanded}
            <pre
              class="prompt-display"
              contenteditable="true"
              bind:textContent={analysisPrompt}
              on:blur={() => savePrompt(analysisPrompt)}
            >{analysisPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={analysisPrompt}
              placeholder="Enter your AI prompt here..."
              rows="10"
              on:blur={() => savePrompt(analysisPrompt)}
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
            {#if selectedJob && jobsWithSavedResponses.has(selectedJob.filename)}
              <button
                class="load-btn"
                on:click={loadLastResponse}
              >
                📂 Load Saved
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
                  {#if jobContent.company}
                    <span class="meta-item">🏢 {jobContent.company}</span>
                  {/if}
                  {#if jobContent.location}
                    <span class="meta-item">📍 {jobContent.location}</span>
                  {/if}
                  {#if jobContent.work_type}
                    <span class="meta-item">💼 {jobContent.work_type}</span>
                  {/if}
                  {#if jobContent.salary_note}
                    <span class="meta-item">💰 {jobContent.salary_note}</span>
                  {/if}
                  {#if jobContent.posted}
                    <span class="meta-item">📅 Posted {jobContent.posted}</span>
                  {/if}
                  {#if jobContent.application_volume}
                    <span class="meta-item">📊 {jobContent.application_volume} applications</span>
                  {/if}
                </div>
                <div class="job-description-content">
                  <div class="job-details">
                    <h4>📋 Job Details</h4>
                    <pre class="job-text">{jobContent.details || 'No details available'}</pre>
                  </div>
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
