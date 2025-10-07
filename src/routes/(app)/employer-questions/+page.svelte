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

  // Comparison mode variables
  let isComparing = false;
  let comparisonResults = null;
  let providers = [];

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
        const response = await fetch(`/api/save-response?type=employer-questions-comparison&jobFilename=${encodeURIComponent(job.filename)}`);
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
    comparisonResults = null;

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

  async function compareAnswers() {
    if (!selectedJob || !jobContent || !jobContent.questions) return;

    isComparing = true;
    comparisonResults = null;

    try {
      const response = await fetch('/api/employer-questions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
          prompt: employerQuestionsPrompt,
          questions: jobContent.questions.map((q) => ({
            q: q.q,
            type: q.type || 'select',
            options: q.opts || []
          })),
          details: jobDescriptionStates[selectedJob.filename] ? jobContent.details : null
        })
      });

      const data = await response.json();

      if (data.success) {
        comparisonResults = data.results;
        await saveComparisonResults(data.results);
      } else {
        alert('Failed to compare: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to compare answers:', error);
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
          type: 'employer-questions-comparison',
          company: selectedJob.company,
          title: selectedJob.title,
          jobFilename: selectedJob.filename,
          response: JSON.stringify(results)
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
      const response = await fetch(
        `/api/save-response?type=employer-questions-comparison&jobFilename=${selectedJob.filename}`
      );
      const data = await response.json();

      if (data.success && data.data && data.data.response) {
        comparisonResults = JSON.parse(data.data.response);
        generatedAnswers = '';
        parsedAnswers = [];
      }
      // Silently fail if no saved response
    } catch (error) {
      console.log('No saved response for this job');
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

  function getProviderName(providerId) {
    if (providerId.includes('claude')) return 'Claude';
    if (providerId.includes('deepseek')) return 'DeepSeek';
    if (providerId.includes('gemini')) return 'Gemini';
    return providerId;
  }

  function getProviderIcon(providerId) {
    if (providerId.includes('claude')) return '🧠';
    if (providerId.includes('deepseek')) return '🤖';
    if (providerId.includes('gemini')) return '💎';
    return '🤖';
  }

  function formatTime(ms) {
    return (ms / 1000).toFixed(2) + 's';
  }

  function formatCurrency(amount, currency = 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
    return formatter.format(amount);
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
	<div class="page-header">
		<h1 class="text-4xl font-bold mb-4 text-primary">❓ Employer Questions</h1>
		<p class="text-base-content/70">Get AI-powered recommendations for employer screening questions</p>
	</div>

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
												await compareAnswers();
											}}
											disabled={isComparing}
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
							type="button"
							class="generate-btn"
							on:click={compareAnswers}
							disabled={isComparing || !jobContent}
						>
							{#if isComparing}
								⏳ Comparing...
							{:else}
								🔍 Compare AI Answers
							{/if}
						</button>
					</div>
				</div>

				{#if jobContent && jobContent.questions}
					<div class="content-section">
						<!-- AI Comparison Results -->
						{#if comparisonResults}
							<div style="margin-bottom: 2rem;">
								<h3 style="margin-bottom: 1.5rem; font-size: 1.5rem;">🔍 AI Comparison Results</h3>
								<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
									{#each comparisonResults as result}
										<div style="background: rgba(128, 128, 128, 0.05); border: 2px solid {result.error ? 'red' : 'teal'}; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column;">
											<!-- Provider Header -->
											<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid {result.error ? 'red' : 'teal'};">
												<h4 style="margin: 0; font-size: 1.2rem;">{getProviderIcon(result.providerId)} {getProviderName(result.providerId)}</h4>
												{#if result.error}
													<span style="background: rgba(255, 0, 0, 0.2); color: red; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">❌ Error</span>
												{:else}
													<span style="background: rgba(0, 128, 128, 0.2); color: teal; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">✅ Success</span>
												{/if}
											</div>

											<!-- AI Response -->
											{#if !result.error}
												<div style="flex: 1; margin-bottom: 1rem;">
													<pre style="background: rgba(0, 0, 0, 0.05); padding: 1rem; border-radius: 8px; font-size: 0.9rem; white-space: pre-wrap; word-wrap: break-word; margin: 0; border: 1px solid rgba(128, 128, 128, 0.2);">{result.text}</pre>
												</div>

												<!-- Copy Button -->
												<button
													class="copy-btn"
													on:click={() => copyToClipboard(result.text)}
													style="width: 100%; margin-bottom: 1rem;"
												>
													📋 Copy
												</button>
											{:else}
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

						<!-- Questions List with AI Recommendations -->
						<div class="job-description-section">
							<h3>📝 Employer Questions ({jobContent.questions.length})</h3>
							<div style="display: flex; flex-direction: column; gap: 1.5rem;">
								{#each jobContent.questions as question, index}
									<div style="background: rgba(128, 128, 128, 0.05); border: 2px solid purple; border-radius: 12px; padding: 1.5rem;">
										<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
											<h4 style="margin: 0; font-size: 1.1rem;">Question {index + 1}</h4>
											<span style="background: rgba(128, 0, 128, 0.2); color: purple; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">{question.type || 'select'}</span>
										</div>
										<p style="font-size: 1rem; margin-bottom: 1rem; line-height: 1.5;">{question.q}</p>
										{#if question.opts && question.opts.length > 0}
											<div style="display: flex; flex-direction: column; gap: 0.75rem;">
												<h5 style="font-size: 0.9rem; opacity: 0.7; margin: 0.5rem 0;">Options:</h5>
												{#each question.opts as option, optIndex}
													<div
														style="background: {isOptionRecommended(index, optIndex) ? 'rgba(0, 128, 128, 0.15)' : 'rgba(128, 128, 128, 0.05)'}; border: 2px solid {isOptionRecommended(index, optIndex) ? 'teal' : 'rgba(128, 128, 128, 0.3)'}; border-radius: 8px; padding: 1rem; display: flex; align-items: center; gap: 1rem; transition: all 0.2s;"
													>
														<div style="background: {isOptionRecommended(index, optIndex) ? 'teal' : 'rgba(128, 128, 128, 0.3)'}; color: white; min-width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;">{optIndex}</div>
														<span style="flex: 1; font-size: 0.95rem;">{option}</span>
														{#if isOptionRecommended(index, optIndex)}
															<span style="background: teal; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">🤖 AI PICK</span>
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
