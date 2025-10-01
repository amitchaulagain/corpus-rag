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
  let isEditingPrompt = false;
  let employerQuestionsPrompt = '';
  let jobDescriptionStates = {}; // Track checkbox state per job filename

  // Reactive statement to help with debugging
  $: {
    if (parsedAnswers.length > 0) {
      console.log('Parsed answers updated:', parsedAnswers);
    }
  }

  const defaultEmployerQuestionsPrompt = `For each of these employer questions, analyze the question and my resume/background, then return ONLY a JSON array with the recommended responses.

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

  onMount(() => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }

    // Load custom prompt from localStorage
    const storedPrompt = localStorage.getItem('employer_questions_prompt');
    if (storedPrompt) {
      employerQuestionsPrompt = storedPrompt;
    } else {
      employerQuestionsPrompt = defaultEmployerQuestionsPrompt;
    }
  });

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

  function savePrompt() {
    localStorage.setItem('employer_questions_prompt', employerQuestionsPrompt);
  }

  function resetPrompt() {
    employerQuestionsPrompt = defaultEmployerQuestionsPrompt;
    localStorage.setItem('employer_questions_prompt', defaultEmployerQuestionsPrompt);
  }
</script>

<main class="container mx-auto max-w-7xl p-4 lg:p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">❓ Employer Questions</h1>
    <p class="text-base-content/70">Get AI-powered recommendations for employer screening questions</p>

    <!-- Always Visible Prompt Section -->
    <div class="card bg-base-100 shadow-xl border border-base-300 hover:border-primary/30 transition-colors mt-6">
      <div class="card-body">
        <h3 class="card-title text-lg">🤖 AI Prompt Editor</h3>
        <div class="mb-4">
          <textarea
            class="textarea textarea-bordered w-full"
            bind:value={employerQuestionsPrompt}
            placeholder="Enter your AI prompt here..."
            rows="20"
          ></textarea>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" on:click={savePrompt}>💾 Save Prompt</button>
          <button class="btn btn-ghost btn-sm" on:click={resetPrompt}>🔄 Reset to Default</button>
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Jobs List -->
    <div class="lg:col-span-1 card bg-base-100 shadow-xl border border-base-300 hover:border-primary/30 transition-colors">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h2 class="card-title text-primary">❓ Jobs with Questions ({jobs.length})</h2>
          <button class="btn btn-ghost btn-sm" class:btn-disabled={isLoading} on:click={loadJobs} disabled={isLoading}>
            {#if isLoading}⏳{:else}🔄{/if}
          </button>
        </div>

        {#if isLoading}
          <div class="flex justify-center items-center py-12">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <span class="ml-4 text-base-content/70">Loading jobs...</span>
          </div>
        {:else if jobs.length === 0}
          <div class="text-center py-12">
            <p class="text-base-content">No employer questions found</p>
            <small class="text-base-content/50">Only jobs with screening questions will appear here</small>
          </div>
        {:else}
          <div class="space-y-3 h-full overflow-y-auto pr-2">
            {#each jobs as job}
              <div
                class="card bg-base-200 shadow-md cursor-pointer hover:shadow-lg hover:shadow-primary/20 hover:border-primary/30 border border-transparent transition-all duration-300 hover:-translate-y-1"
                class:ring-2={selectedJob?.filename === job.filename}
                class:ring-primary={selectedJob?.filename === job.filename}
                on:click={() => selectJob(job)}
              >
                <div class="card-body p-4">
                  <div class="flex justify-between items-start mb-2">
                    <div class="badge badge-primary badge-sm">
                      ❓ {job.questionCount} Questions
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        bind:checked={jobDescriptionStates[job.filename]}
                        on:click|stopPropagation
                      />
                      <div class="text-xs text-base-content/50">{formatFileSize(job.size)}</div>
                    </div>
                  </div>
                  <h3 class="font-bold text-sm text-primary">{job.company}</h3>
                  <p class="text-sm text-base-content/80">{job.title}</p>
                  {#if job.location}
                    <p class="text-xs text-base-content/60">📍 {job.location}</p>
                  {/if}
                  {#if job.hasJobDetails}
                    <p class="text-xs text-success">💼 Has job description too</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Q&A Panel -->
    <div class="lg:col-span-3">
      <div class="card bg-base-100 shadow-xl border border-base-300 hover:border-primary/30 transition-colors h-full">
        <div class="card-body">
          {#if !selectedJob}
            <div class="text-center py-16">
              <div class="text-6xl mb-4">❓</div>
              <h2 class="text-2xl font-bold mb-2 text-primary">Select a job with questions</h2>
              <p class="text-base-content/70">Choose from employer screening questions on the left to get AI-powered answer recommendations</p>
            </div>
          {:else}
            <div class="mb-6">
              <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h2 class="text-2xl font-bold text-primary">{selectedJob.company}</h2>
                  <h3 class="text-lg font-semibold text-base-content">{selectedJob.title}</h3>
                  {#if selectedJob.location}
                    <p class="text-sm text-base-content/70">📍 {selectedJob.location}</p>
                  {/if}
                  <p class="text-sm text-base-content/70">❓ {selectedJob.questionCount} screening questions</p>
                </div>

                <button
                  class="btn btn-primary"
                  class:loading={isGenerating}
                  class:btn-disabled={isGenerating || !jobContent}
                  on:click={generateAnswers}
                  disabled={isGenerating || !jobContent}
                >
                  {#if isGenerating}
                    Generating Answers...
                  {:else}
                    ✅ Get Answer Recommendations
                  {/if}
                </button>
              </div>
            </div>

            {#if jobContent && jobContent.questions}
              <div class="space-y-6">
                <!-- Generated Answers -->
                {#if generatedAnswers}
                  <div class="card bg-success bg-opacity-10 border-2 border-success border-opacity-30 shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <div class="card-body">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="card-title text-success">🎯 AI Recommendations</h3>
                        <div class="flex gap-2">
                          <button class="btn btn-ghost btn-sm" on:click={() => copyToClipboard(generatedAnswers)}>
                            📋 Copy All
                          </button>
                          <button class="btn btn-ghost btn-sm" class:btn-disabled={isGenerating} on:click={generateAnswers} disabled={isGenerating}>
                            🔄 Regenerate
                          </button>
                        </div>
                      </div>
                      <div class="bg-base-200 p-4 rounded-lg overflow-x-auto">
                        <pre class="text-sm whitespace-pre-wrap">{generatedAnswers}</pre>
                      </div>
                    </div>
                  </div>
                {/if}

                <!-- Questions List -->
                <div class="card bg-base-200 border border-base-300 shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div class="card-body">
                    <h3 class="card-title text-primary mb-4">📝 Employer Questions ({jobContent.questions.length})</h3>
                    <div class="space-y-6 h-full overflow-y-auto pr-4">
                      {#each jobContent.questions as question, index}
                        <div class="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg hover:border-primary/20 transition-all duration-200">
                          <div class="card-body p-6">
                            <div class="flex justify-between items-center mb-2">
                              <h4 class="font-semibold text-primary">Question {index + 1}</h4>
                              <div class="badge badge-outline badge-sm">{question.type || 'select'}</div>
                            </div>
                            <p class="text-base-content mb-3">{question.q}</p>
                            {#if question.opts && question.opts.length > 0}
                              <div>
                                <h5 class="font-medium text-base-content/80 mb-2">Options:</h5>
                                <div class="space-y-3">
                                  {#each question.opts as option, optIndex}
                                    <div class="flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 hover:border-primary/30"
                                         class:bg-success={isOptionRecommended(index, optIndex)}
                                         class:text-success-content={isOptionRecommended(index, optIndex)}
                                         class:border-success={isOptionRecommended(index, optIndex)}
                                         class:border-2={isOptionRecommended(index, optIndex)}
                                         class:shadow-lg={isOptionRecommended(index, optIndex)}
                                         class:ring-2={isOptionRecommended(index, optIndex)}
                                         class:ring-success={isOptionRecommended(index, optIndex)}
                                         class:ring-opacity-50={isOptionRecommended(index, optIndex)}
                                         class:border-base-300={!isOptionRecommended(index, optIndex)}>
                                      <div class="badge badge-sm font-bold" class:badge-success={isOptionRecommended(index, optIndex)} class:badge-outline={!isOptionRecommended(index, optIndex)}>
                                        {optIndex}
                                      </div>
                                      <span class="flex-1 text-sm font-medium" class:font-bold={isOptionRecommended(index, optIndex)}>{option}</span>
                                      {#if isOptionRecommended(index, optIndex)}
                                        <div class="badge badge-success badge-sm font-bold animate-pulse">🤖 AI RECOMMENDED</div>
                                      {/if}
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex justify-center items-center py-12">
                <span class="loading loading-spinner loading-lg text-primary"></span>
                <span class="ml-4 text-base-content/70">Loading questions...</span>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
</main>
