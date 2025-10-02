<script>
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

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
      const response = await apiRequest('/api/prompts/employer-questions');
      const data = await response.json();
      employerQuestionsPrompt = data.content;
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
  });

  async function savePrompt(content) {
    try {
      await apiRequest('/api/prompts/employer-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  async function loadJobs() {
    if (!user) return;

    isLoading = true;
    try {
      const response = await apiRequest('/api/jobs');
      const data = await response.json();

      if (data.success) {
        // Filter to only jobs with questions
        jobs = (data.data.jobs || []).filter(job => job.hasQuestions);
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
    generatedAnswers = '';
    parsedAnswers = [];

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

  async function generateAnswers() {
    if (!selectedJob || !jobContent || !jobContent.questions) return;

    isGenerating = true;
    try {
      const response = await apiRequest('/api/generate', {
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
      <h3>🤖 AI Prompt Editor</h3>
      <div class="prompt-container">
        <div class="prompt-area">
          <textarea
            class="prompt-editor"
            bind:value={employerQuestionsPrompt}
            placeholder="Enter your AI prompt here..."
            rows="10"
            on:blur={() => savePrompt(employerQuestionsPrompt)}
          ></textarea>
        </div>
      </div>
    </div>
  </div>

  <div class="main-content">
    <!-- Jobs List -->
    <div class="jobs-sidebar">
      <div class="sidebar-header">
        <h2>❓ Jobs with Questions ({jobs.length})</h2>
        <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
          {#if isLoading}⏳{:else}🔄{/if}
        </button>
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
          {#each jobs as job}
            <div
              class="job-item"
              class:selected={selectedJob?.filename === job.filename}
              on:click={() => selectJob(job)}
            >
              <div class="job-header">
                <span class="job-type">
                  ❓ {job.questionCount} Questions
                </span>
                <span class="job-size">{formatFileSize(job.size)}</span>
              </div>
              <h3 class="job-company">{job.company}</h3>
              <p class="job-title">{job.title}</p>
              {#if job.location}
                <p class="job-location">📍 {job.location}</p>
              {/if}
              {#if job.hasJobDetails}
                <p class="job-questions">💼 Has job description too</p>
              {/if}
            </div>
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
                    <button class="regenerate-btn" on:click={generateAnswers} disabled={isGenerating}>
                      🔄 Regenerate
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

  .prompt-section h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 1.1rem;
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

  .main-content {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 30px;
    min-height: 700px;
  }

  /* Jobs Sidebar */
  .jobs-sidebar {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e5e5e5;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #dee2e6;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #495057;
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
    cursor: pointer;
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

  /* Q&A Panel */
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

  .generate-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #218838;
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .question-item {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .question-header h4 {
    margin: 0;
    color: #333;
  }

  .question-type {
    background: #6c757d;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
  }

  .question-text {
    margin: 0 0 15px 0;
    color: #555;
  }

  .options-list h5 {
    margin: 0 0 10px 0;
    color: #495057;
    font-size: 0.9rem;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 12px;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    margin-bottom: 8px;
    transition: all 0.2s;
  }

  .option-item.recommended {
    border-color: #28a745;
    background: #f0fff4;
  }

  .option-index {
    background: #e9ecef;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .option-text {
    flex: 1;
  }

  .recommended-badge {
    background: #28a745;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }
</style>