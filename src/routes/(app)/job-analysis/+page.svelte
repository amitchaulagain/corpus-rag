<script>
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';
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

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }

    // Load prompt from the server
    try {
      const response = await apiRequest('/api/prompts/job-analysis');
      const data = await response.json();
      analysisPrompt = data.content;
      lastSavedPrompt = data.content || '';
      isPromptModified = data.isModified || false;
      initialLoaded = true;

      // Load default prompt
      const defaultResponse = await apiRequest('/api/prompts/job-analysis?default=true');
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
      const response = await apiRequest('/api/prompts/job-analysis', {
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
      const response = await apiRequest('/api/jobs');
      const data = await response.json();

      if (data.success) {
        // Filter to only jobs with descriptions (for cover letters)
        jobs = (data.data.jobs || []).filter(job => job.hasJobDetails);

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

  async function selectJob(job) {
    if (job.type === 'error') return;

    selectedJob = job;
    jobContent = null;
    analysisResult = null;

    try {
      const response = await apiRequest(`/api/jobs/${job.filename}`);
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
      const response = await apiRequest('/api/generate', {
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
          // 1. Try ```json ... ```
          let match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonString = match[1].trim();
          } else {
            // 2. Try generic ``` ... ```
            match = rawText.match(/```\s*([\s\S]*?)\s*```/);
            if (match) {
              jsonString = match[1].trim();
            } else {
              // 3. Try to find JSON object boundaries
              const startIdx = rawText.indexOf('{');
              const endIdx = rawText.lastIndexOf('}');
              if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                jsonString = rawText.substring(startIdx, endIdx + 1);
              }
            }
          }

          analysisResult = JSON.parse(jsonString);

          // Save the response
          await saveResponse(analysisResult);
        } catch (e) {
          console.error('Failed to parse analysis JSON:', e);
          console.error('Raw response:', data.data.generatedText);
          alert('The analysis result was not valid JSON. Please check the prompt and try again.');
          // Optionally, you can show the raw text for debugging
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
      await apiRequest('/api/save-response', {
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
    } catch (error) {
      console.error('Failed to save response:', error);
      // Don't show alert, just log - saving is a nice-to-have
    }
  }

  async function loadLastResponse() {
    if (!selectedJob) return;

    try {
      const response = await apiRequest(`/api/save-response?type=job-analysis&jobFilename=${encodeURIComponent(selectedJob.filename)}`);
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
              >
                <div on:click={() => selectJob(job)} style="cursor: pointer;">
                  <div class="job-header">
                    <span class="job-type">
                      {#if job.hasQuestions}
                        💼❓ Job + Q&A
                      {:else}
                        💼 Job Only
                      {/if}
                    </span>
                    <span class="job-size">{formatFileSize(job.size)}</span>
                  </div>
                  <h3 class="job-company">{job.company}</h3>
                  <p class="job-title">{job.title}</p>
                  {#if job.location}
                    <p class="job-location">📍 {job.location}</p>
                  {/if}
                  {#if job.hasQuestions}
                    <p class="job-questions">❓ {job.questionCount} questions</p>
                  {/if}
                </div>
                <button
                  class="quick-action-btn"
                  on:click|stopPropagation={async () => {
                    await selectJob(job);
                    await generateAnalysis();
                  }}
                  disabled={isGenerating}
                >
                  🎯 Analyze
                </button>
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
            <button
              class="load-btn"
              on:click={loadLastResponse}
              disabled={!selectedJob}
            >
              📂 Load Saved
            </button>
          </div>
        </div>

        {#if jobContent}
          <div class="content-section">
            <!-- Generated Analysis -->
            {#if analysisResult}
              <JobAnalysisResult {analysisResult} />
            {/if}

            <!-- Job Description -->
            <div class="job-description-section" style="margin-top: 2rem;">
              <h3>📋 Job Description</h3>
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

  .page-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e5e5;
  }

  .page-header h1 {
    color: #333;
    margin-bottom: 10px;
    font-size: 2.2rem;
  }

  .page-header p {
    color: #666;
    font-size: 1.1rem;
    margin: 0 0 20px 0;
  }

  .prompt-section {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
    max-width: none;
  }

  .prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .prompt-section h3 {
    margin: 0;
    color: #333;
    font-size: 1.1rem;
    user-select: none;
  }

  .prompt-section h3:hover {
    color: #007acc;
  }

  .prompt-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .prompt-area {
    width: 100%;
  }

  .prompt-editor {
    width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.5;
    resize: vertical;
    background: white;
    color: #333;
    height: auto;
  }

  .prompt-editor:focus {
    outline: none;
    border-color: #007acc;
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .prompt-display {
    width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.5;
    background: white;
    color: #333;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: none;
    overflow-y: auto;
  }

  .prompt-display:focus {
    outline: none;
    border-color: #007acc;
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .prompt-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-start;
  }

  .save-btn, .reset-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .save-btn:hover {
    background: #218838;
  }

  .reset-btn {
    background: #6c757d;
  }

  .reset-btn:hover {
    background: #5a6268;
  }

  .reset-btn-small {
    background: #6c757d;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
  }

  .reset-btn-small:hover {
    background: #5a6268;
  }

  .main-content {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 30px;
    min-height: 700px;
    transition: grid-template-columns 0.3s ease;
  }

  .main-content:has(.jobs-sidebar.collapsed) {
    grid-template-columns: 60px 1fr;
  }

  /* Jobs Sidebar */
  .jobs-sidebar {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e5e5e5;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .jobs-sidebar.collapsed {
    padding: 10px 5px;
    width: 60px;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #dee2e6;
  }

  .jobs-sidebar.collapsed .sidebar-header {
    flex-direction: column;
    padding-bottom: 10px;
    margin-bottom: 10px;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #495057;
    user-select: none;
    flex: 1;
  }

  .sidebar-header h2:hover {
    color: #007bff;
  }

  .jobs-sidebar.collapsed .sidebar-header h2 {
    font-size: 1.5rem;
    text-align: center;
  }

  .refresh-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .refresh-btn:hover {
    background: #e9ecef;
  }

  .jobs-list {
    height: 100%;
    overflow-y: auto;
  }

  .job-item {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 12px;
    transition: all 0.2s;
  }

  .job-item:hover {
    border-color: #007bff;
    box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
  }

  .job-item.selected {
    border-color: #007bff;
    background: #f8f9ff;
  }

  .quick-action-btn {
    width: 100%;
    margin-top: 10px;
    padding: 6px 12px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .quick-action-btn:hover:not(:disabled) {
    background: #0056b3;
  }

  .quick-action-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .job-type {
    background: #007bff;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .job-size {
    font-size: 0.8rem;
    color: #6c757d;
  }

  .job-company {
    margin: 0 0 5px 0;
    font-size: 1rem;
    font-weight: 600;
    color: #333;
  }

  .job-title {
    margin: 0 0 5px 0;
    font-size: 0.9rem;
    color: #555;
    line-height: 1.3;
  }

  .job-location, .job-questions {
    margin: 0 0 3px 0;
    font-size: 0.8rem;
    color: #666;
  }

  /* Collapsed Jobs List */
  .jobs-list-collapsed {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 5px 0;
  }

  .job-icon {
    background: white;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    padding: 10px;
    font-size: 1rem;
    font-weight: 600;
    color: #495057;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 45px;
  }

  .job-icon:hover {
    border-color: #007bff;
    background: #f8f9ff;
    color: #007bff;
    box-shadow: 0 2px 4px rgba(0, 123, 255, 0.15);
    transform: translateX(2px);
  }

  .job-icon.selected {
    border-color: #007bff;
    background: #007bff;
    color: white;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    font-weight: 700;
  }

  /* Cover Letter Panel */
  .cover-letter-panel {
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e5e5;
    overflow: hidden;
  }

  .no-selection {
    padding: 80px 40px;
    text-align: center;
    color: #666;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 20px;
    opacity: 0.5;
  }

  .no-selection h2 {
    margin-bottom: 10px;
    color: #333;
  }

  .job-header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 25px;
    border-bottom: 1px solid #dee2e6;
    background: #f8f9fa;
  }

  .job-info h2 {
    margin: 0 0 8px 0;
    color: #333;
  }

  .job-info h3 {
    margin: 0 0 10px 0;
    color: #555;
    font-weight: 500;
  }

  .location {
    margin: 0;
    color: #666;
  }

  .generate-section {
    display: flex;
    gap: 10px;
  }

  .generate-btn, .load-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #218838;
  }

  .generate-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .load-btn {
    background: #17a2b8;
  }

  .load-btn:hover:not(:disabled) {
    background: #138496;
  }

  .load-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .content-section {
    padding: 25px;
  }

  .cover-letter-section {
    margin-bottom: 30px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .section-header h3 {
    margin: 0;
    color: #333;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .copy-btn {
    background: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .copy-btn:hover {
    background: #138496;
  }


  .generated-content {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 25px;
    margin-bottom: 30px;
  }

  .cover-letter-text {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: Georgia, serif;
    line-height: 1.7;
    color: #333;
    font-size: 1.05rem;
  }

  .job-description-section h3 {
    margin-top: 0;
    color: #495057;
    margin-bottom: 20px;
  }

  .job-details-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    overflow: hidden;
  }

  .job-meta {
    background: #f8f9fa;
    padding: 15px 20px;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
  }

  .meta-item {
    background: white;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.85rem;
    border: 1px solid #dee2e6;
    color: #495057;
  }

  .job-description-content {
    padding: 20px;
  }

  .job-details h4 {
    color: #495057;
    margin: 0 0 15px 0;
    font-size: 1rem;
  }

  .job-questions-preview {
    margin-top: 25px;
    padding-top: 20px;
    border-top: 1px solid #e9ecef;
  }

  .job-questions-preview h4 {
    color: #495057;
    margin: 0 0 15px 0;
    font-size: 1rem;
  }

  .questions-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .question-preview {
    padding: 8px 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .question-preview strong {
    color: #495057;
  }

  .job-link {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #e9ecef;
  }

  .job-link a {
    color: #007acc;
    text-decoration: none;
    font-weight: 500;
  }

  .job-link a:hover {
    text-decoration: underline;
  }

  .job-text {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #333;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .empty-state small {
    display: block;
    margin-top: 5px;
    color: #999;
  }

  .login-required {
    text-align: center;
    padding: 80px 20px;
  }

  .login-required a {
    color: #007bff;
    text-decoration: none;
  }

  .login-required a:hover {
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
      gap: 20px;
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