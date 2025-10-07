<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  

  let user = null;
  let jobs = [];
  let selectedJob = null;
  let jobContent = null;
  let isLoading = false;
  let isGenerating = false;
  let generatedAnswers = '';
  let parsedAnswers = [];
  let employerQuestionsPrompt = '';
  let jobDescriptionStates = {}; // Track checkbox state per job filename

  let debounceTimeout;
  let isSidebarCollapsed = false;
  let isPromptExpanded = false;
  let isPromptModified = false;
  let defaultPrompt = '';
  let jobsWithSavedResponses = new Set();

  // $: makes this a reactive statement that runs when employerQuestionsPrompt changes
  $: if (employerQuestionsPrompt) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      savePrompt(employerQuestionsPrompt);
    }, 500); // 500ms debounce delay
  }

  // Reactive statement to help with debugging
  $: {
    if (parsedAnswers.length > 0) {
      console.log('Parsed answers updated:', parsedAnswers);
    }
  }

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }

    // Load prompt from the server
    try {
      const response = await fetch('/api/prompts/employer-questions');
      const data = await response.json();
      employerQuestionsPrompt = data.content;
      isPromptModified = data.isModified || false;
    } catch (error) {
      console.error('Failed to load prompt:', error);
      // Fallback to default if loading fails
      employerQuestionsPrompt = `For each of these employer questions, analyze the question and my resume/background, then return ONLY a JSON array with the recommended responses.

Response Format:
- For "select" questions: single number (e.g., 2)
- For "checkbox" questions: array of numbers (e.g., [0,3,7])

Example: If Q1 is select (recommend option 3), Q2 is checkbox (recommend options 1,4), Q3 is select (recommend option 2):
Return: [3, [1,4], 2]

Rules:
- Return ONLY the array, no explanations or text
- Use 0-based indexing (first option = 0, second = 1, etc.)
- Array length must match number of questions
- Select questions = single number, checkbox questions = array of numbers
- Consider my actual experience and background from resume
- Choose answers that position me as the ideal candidate

Questions: [Questions List]`;
    }

    // Load default prompt
    try {
      const response = await fetch('/api/prompts/employer-questions?default=true');
      const data = await response.json();
      defaultPrompt = data.content;
    } catch (error) {
      console.error('Failed to load default prompt:', error);
    }
  });

  async function savePrompt(content) {
    try {
      await fetch('/api/prompts/employer-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      isPromptModified = content !== defaultPrompt;
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  async function resetPrompt() {
    if (confirm('Reset prompt to default? This will overwrite your current prompt.')) {
      employerQuestionsPrompt = defaultPrompt;
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
        // Filter to only jobs with questions
        jobs = (data.data.jobs || []).filter(job => job.hasQuestions);

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
        const response = await fetch(`/api/save-response?type=employer-questions&jobFilename=${encodeURIComponent(job.filename)}`);
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
    generatedAnswers = '';
    parsedAnswers = [];

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

  async function generateAnswers() {
    if (!selectedJob || !jobContent || !jobContent.questions) return;

    isGenerating = true;
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'employer_answers',
          ...(jobDescriptionStates[selectedJob.filename] && { details: jobContent.details }),
          questions: jobContent.questions,
          prompt: employerQuestionsPrompt
        })
      });

      const data = await response.json();

      if (data.success) {
        generatedAnswers = data.data.generatedText;
        parsedAnswers = parseAIAnswers(data.data.generatedText);
        console.log('Generated answers:', generatedAnswers);
        console.log('Parsed answers:', parsedAnswers);

        // Save the response
        await saveResponse({ raw: generatedAnswers, parsed: parsedAnswers });
      } else {
        alert('Failed to generate answers: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to generate answers:', error);
      alert('Failed to generate answers: ' + error.message);
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
          type: 'employer-questions',
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
    }
  }

  async function loadLastResponse() {
    if (!selectedJob) return;

    try {
      const response = await fetch(`/api/save-response?type=employer-questions&jobFilename=${encodeURIComponent(selectedJob.filename)}`);
      const data = await response.json();

      if (data.success && data.data) {
        generatedAnswers = data.data.response.raw;
        parsedAnswers = data.data.response.parsed || parseAIAnswers(data.data.response.raw);
      } else {
        alert('No saved answers found for this job.');
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

  function parseAIAnswers(aiResponse) {
    try {
      console.log('Parsing AI response:', aiResponse);

      // Check if aiResponse is valid
      if (!aiResponse || typeof aiResponse !== 'string') {
        console.warn('AI response is empty or invalid:', aiResponse);
        return [];
      }

      // Clean the response and extract the JSON array
      const cleanResponse = aiResponse.trim();
      console.log('Clean response:', cleanResponse);

      // Try to parse as JSON directly first - find balanced brackets
      try {
        let startIndex = cleanResponse.indexOf('[');
        if (startIndex !== -1) {
          let bracketCount = 0;
          let endIndex = startIndex;

          for (let i = startIndex; i < cleanResponse.length; i++) {
            if (cleanResponse[i] === '[') bracketCount++;
            if (cleanResponse[i] === ']') bracketCount--;
            if (bracketCount === 0) {
              endIndex = i;
              break;
            }
          }

          const jsonString = cleanResponse.substring(startIndex, endIndex + 1);
          console.log('Attempting to parse JSON string:', jsonString);

          const array = JSON.parse(jsonString);
          console.log('Successfully parsed complex array:', array);
          return array;
        }
      } catch (error) {
        console.error('Failed to parse as JSON:', error);
      }

      console.log('Could not parse AI response, returning empty array');
      return [];
    } catch (error) {
      console.error('Error parsing AI answers:', error);
      return [];
    }
  }

  function isOptionRecommended(questionIndex, optionIndex) {
    if (!parsedAnswers || parsedAnswers.length <= questionIndex) {
      return false;
    }

    const recommendedResponse = parsedAnswers[questionIndex];

    if (Array.isArray(recommendedResponse)) {
      // Checkbox question: check if optionIndex is in the array
      return recommendedResponse.includes(optionIndex);
    } else {
      // Select question: direct comparison
      return recommendedResponse === optionIndex;
    }
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

<main class="container mx-auto max-w-6xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">❓ Employer Questions</h1>
    <p class="text-base-content/70">Get AI-powered recommendations for employer screening questions</p>

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
              bind:textContent={employerQuestionsPrompt}
              on:blur={() => savePrompt(employerQuestionsPrompt)}
            >{employerQuestionsPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={employerQuestionsPrompt}
              placeholder="Enter your AI prompt here..."
              rows="10"
              on:blur={() => savePrompt(employerQuestionsPrompt)}
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
            ❓
          {:else}
            💼 Jobs with Questions
          {/if}
        </h2>
        {#if !isSidebarCollapsed}
          <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
            {#if isLoading}⏳{:else}🔄{/if}
          </button>
        {/if}
      </div>

      {#if isLoading}
        <div class="loading">Loading jobs...</div>
      {:else if jobs.length === 0}
        <div class="empty-state">
          <p>No employer questions found</p>
          <small>Only jobs with screening questions will appear here</small>
        </div>
      {:else}
        <div class="jobs-list">
          {#each jobs as job, index}
            {#if isSidebarCollapsed}
              <button
                class="job-icon"
                class:selected={selectedJob?.filename === job.filename}
                on:click={() => selectJob(job)}
                title="{job.company} - {job.title}"
              >
                {index + 1}
              </button>
            {:else}
              <div
                class="job-item"
                class:selected={selectedJob?.filename === job.filename}
                class:has-saved={jobsWithSavedResponses.has(job.filename)}
              >
                <div class="job-header">
                  <span class="job-type" on:click={() => selectJob(job)} style="cursor: pointer;">
                    ❓ {job.questionCount} Questions
                  </span>
                  <div class="job-header-right">
                    <span class="job-size">{formatFileSize(job.size)}</span>
                    <button
                      class="quick-action-btn-inline"
                      on:click|stopPropagation={async () => {
                        await selectJob(job);
                        await generateAnswers();
                      }}
                      disabled={isGenerating}
                    >
                      💡
                    </button>
                  </div>
                </div>
                <div on:click={() => selectJob(job)} style="cursor: pointer;">
                  <h3 class="job-company">{job.company}</h3>
                  <p class="job-title">{job.title}</p>
                  {#if job.location}
                    <p class="job-location">📍 {job.location}</p>
                  {/if}
                  {#if job.hasJobDetails}
                    <p class="job-questions">💼 Has job description too</p>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Q&A Panel -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">❓</div>
          <h2>Select a job to see questions</h2>
          <p>Choose from the jobs on the left to start getting answer recommendations</p>
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
              on:click={generateAnswers}
              disabled={isGenerating || !jobContent}
            >
              {#if isGenerating}
                ⏳ Generating...
              {:else}
                ✅ Get Recommendations
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

        {#if jobContent && jobContent.questions}
          <div class="content-section">
            <!-- Generated Answers -->
            {#if generatedAnswers}
              <div class="cover-letter-section">
                <div class="section-header">
                  <h3>🎯 AI Recommendations</h3>
                  <div class="actions">
                    <button class="copy-btn" on:click={() => copyToClipboard(generatedAnswers)}>
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div class="generated-content">
                  <pre class="cover-letter-text">{generatedAnswers}</pre>
                </div>
              </div>
            {/if}

            <!-- Questions List -->
            <div class="job-description-section">
              <h3>📝 Employer Questions ({jobContent.questions.length})</h3>
              <div class="space-y-6">
                {#each jobContent.questions as question, index}
                  <div class="question-item">
                    <div class="question-header">
                      <h4>Question {index + 1}</h4>
                      <div class="question-type">{question.type || 'select'}</div>
                    </div>
                    <p class="question-text">{question.q}</p>
                    {#if question.opts && question.opts.length > 0}
                      <div class="options-list">
                        <h5>Options:</h5>
                        {#each question.opts as option, optIndex}
                          <div
                            class="option-item"
                            class:recommended={isOptionRecommended(index, optIndex)}
                          >
                            <div class="option-index">{optIndex}</div>
                            <span class="option-text">{option}</span>
                            {#if isOptionRecommended(index, optIndex)}
                              <div class="recommended-badge">🤖 AI RECOMMENDED</div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <div class="loading">Loading questions...</div>
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
