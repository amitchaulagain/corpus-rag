<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';
  import { employerQuestionsStore } from '$lib/employer-questions-store';
  import { findAnswerSources } from '$lib/utils/source-matcher';
  import type { GenericQuestion } from '$lib/models/generic-questions';
  import type { AnswerWithReferences, ParsedAnswer } from '$lib/types/answer-references';
  import { getAnswerValue, getAnswerSources } from '$lib/types/answer-references';


  let user = null;
  let jobs = [];
  let selectedJob = null;
  let jobContent = null;
  let isLoading = false;
  let employerQuestionsPrompt = '';
  let jobDescriptionStates = {}; // Track checkbox state per job filename

  let isSidebarCollapsed = false;
  let isPromptExpanded = false;
  let isPromptModified = false;
  let defaultPrompt = '';
  let jobsWithSavedResponses = new Set();
  let lastSavedPrompt = '';
  let isSavingPrompt = false;

  let providers = [];
  let genericQuestionsList: GenericQuestion[] = [];
  let latestJobSelectionRequest = 0;

  // View mode: 'raw' | 'api' | 'readable'
  let viewMode: 'raw' | 'api' | 'readable' = 'readable';
  let rawDataExpanded = false;
  let apiResponseExpanded = false;
  let kbPanelOpen = true;
  let kbFullColumnOpen = false;

  // Reactive store bindings
  $: generatedAnswers = $employerQuestionsStore.generatedAnswers;
  $: parsedAnswers = $employerQuestionsStore.parsedAnswers;
  $: isGenerating = $employerQuestionsStore.isGenerating;
  $: isComparing = $employerQuestionsStore.isComparing;

  // Only show results when they belong to the currently selected job (fixes wrong data when switching jobs)
  $: storeMatchesCurrentJob = $employerQuestionsStore.selectedJobFilename === selectedJob?.filename;
  $: effectiveParsedAnswers = storeMatchesCurrentJob ? $employerQuestionsStore.parsedAnswers : [];
  $: effectiveComparisonResults = storeMatchesCurrentJob && $employerQuestionsStore.comparisonResults
    ? Object.entries($employerQuestionsStore.comparisonResults).map(([providerId, result]) => ({
        providerId,
        ...result
      }))
    : null;
  // Keep comparisonResults name for template (use effective so switching jobs clears display)
  $: comparisonResults = effectiveComparisonResults;


  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      await loadJobs();

      // Restore selected job if stored
      const storedJobFilename = $employerQuestionsStore.selectedJobFilename;
      if (storedJobFilename && jobs.length > 0) {
        const job = jobs.find(j => j.filename === storedJobFilename);
        if (job) {
          selectedJob = job;
          await selectJob(job);
        }
      }
    }

    // Load prompt from the server
    try {
      const response = await fetch('/api/prompts/employer-questions');
      const data = await response.json();
      employerQuestionsPrompt = data.content;
      lastSavedPrompt = data.content || '';
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

    // Load all generic Q&A for the "All generic Q&A" list (matched ones highlighted)
    try {
      genericQuestionsList = await fetchGenericQuestions();
    } catch (error) {
      console.error('Failed to load generic questions list:', error);
    }
  });

  function onPromptChange() {
    isPromptModified = employerQuestionsPrompt !== lastSavedPrompt;
  }

  async function savePromptToFile() {
    if (employerQuestionsPrompt === lastSavedPrompt) {
      alert('No changes to save');
      return;
    }

    isSavingPrompt = true;
    try {
      const response = await fetch('/api/prompts/employer-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: employerQuestionsPrompt })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = employerQuestionsPrompt;
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
      employerQuestionsPrompt = defaultPrompt;
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
    const requestId = ++latestJobSelectionRequest;

    selectedJob = job;
    jobContent = null;

    // Cancel any in-flight generation/comparison before switching jobs
    employerQuestionsStore.cancelGeneration();
    // Switch store to this job and clear previous job's answers so KB reflects the new job
    employerQuestionsStore.switchJob(job.filename);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.filename)}`);
      const data = await response.json();
      if (requestId !== latestJobSelectionRequest) return;

      if (data.success) {
        const content = data.data?.content;
        if (!content) {
          alert('Failed to load job details: missing content');
          return;
        }
        jobContent = content;
        // Refresh KB list and load this job's saved comparison (so "used for" badges match this job)
        try {
          genericQuestionsList = await fetchGenericQuestions();
        } catch (e) {
          console.error('Failed to refresh generic questions:', e);
        }
        if (requestId !== latestJobSelectionRequest) return;
        await loadLastResponse(job, content, requestId);
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
    const compareJob = selectedJob;
    const compareJobFilename = compareJob.filename;
    const compareJobContent = jobContent;

    // Start comparison using store
    employerQuestionsStore.startComparison(compareJobFilename);
    // Let the UI paint "Comparing..." before we block on fetch/stream
    await new Promise((r) => requestAnimationFrame(r));

    try {
      const response = await fetch('/api/employer-questions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
          prompt: employerQuestionsPrompt,
          questions: compareJobContent.questions.map((q) => ({
            q: q.q,
            type: q.type || 'select',
            options: q.opts || []
          })),
          details: jobDescriptionStates[compareJobFilename] ? compareJobContent.details : null,
          stream: true
        }),
        signal: employerQuestionsStore.getAbortSignal()
      });

      // Handle streaming response: buffer incomplete SSE lines to avoid parse errors and crashes
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      // Throttle store updates during stream to avoid UI flood and crashes
      const pendingUpdates: Array<{ providerId: string; result: any }> = [];
      let rafScheduled = false;
      function flushPendingUpdates() {
        rafScheduled = false;
        for (const { providerId, result } of pendingUpdates) {
          employerQuestionsStore.updateComparisonResult(providerId, result);
        }
        pendingUpdates.length = 0;
      }
      function scheduleUpdate(providerId: string, result: any) {
        pendingUpdates.push({ providerId, result });
        if (!rafScheduled) {
          rafScheduled = true;
          requestAnimationFrame(flushPendingUpdates);
        }
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          decoder.decode(); // flush any remaining bytes
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by double newline; a single chunk may contain partial JSON
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? ''; // keep incomplete part in buffer

        for (const event of events) {
          // Yield before each event so one large JSON.parse never blocks the UI
          await new Promise((r) => requestAnimationFrame(r));

          const line = event.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;

          let data: any;
          try {
            data = JSON.parse(line.slice(6));
          } catch (_) {
            continue; // skip malformed or incomplete line
          }

          if (data.done) {
            // Ignore stale stream if user switched jobs mid-compare
            if ($employerQuestionsStore.selectedJobFilename !== compareJobFilename) {
              employerQuestionsStore.finishComparison();
              return;
            }
            // Flush any pending updates so store has all results before we read
            if (pendingUpdates.length > 0) flushPendingUpdates();
            // Parse answers from the first successful result before finishing
            const results = $employerQuestionsStore.comparisonResults;
            if (results) {
              const allResults = Object.values(results);
              const firstSuccessfulResult = allResults.find((r: any) => {
                const t = r?.text ?? r?.answer;
                return r && t && !r.error;
              }) as any;

              const answerText = firstSuccessfulResult?.text ?? firstSuccessfulResult?.answer;
              if (firstSuccessfulResult && answerText) {
                const parsed = await parseAIAnswersWithSources(
                  answerText,
                  compareJobContent.questions,
                  jobDescriptionStates[compareJobFilename] ? compareJobContent.details : null,
                  firstSuccessfulResult?.metadata?.retrieval?.evidenceByQuestion as any[] | undefined
                );
                if (parsed && parsed.length > 0) {
                  employerQuestionsStore.setParsedAnswers(parsed);
                }
              }
            }

            employerQuestionsStore.finishComparison();
            await saveComparisonResults(compareJob, $employerQuestionsStore.comparisonResults);
            return;
          }

          if (data.error) {
            alert(`Error: ${data.error}`);
            employerQuestionsStore.finishComparison();
            return;
          }

          if (data.providerId && data.result) {
            if ($employerQuestionsStore.selectedJobFilename !== compareJobFilename) continue;
            scheduleUpdate(data.providerId, data.result);
          }
        }
      }

      // Stream ended without data.done; parse results and update KB (same as data.done path)
      if ($employerQuestionsStore.selectedJobFilename !== compareJobFilename) {
        employerQuestionsStore.finishComparison();
        return;
      }
      if (pendingUpdates.length > 0) flushPendingUpdates();
      const stateAfterStream = get(employerQuestionsStore);
      const resultsAfterStream = stateAfterStream?.comparisonResults;
      if (resultsAfterStream && compareJobContent?.questions) {
        const allResults = Object.values(resultsAfterStream);
        const firstSuccessful = allResults.find((r: any) => {
          const t = r?.text ?? r?.answer;
          return r && t && !r.error;
        }) as any;
        const answerText = firstSuccessful?.text ?? firstSuccessful?.answer;
        if (firstSuccessful && answerText) {
          const parsed = await parseAIAnswersWithSources(
            answerText,
            compareJobContent.questions,
            jobDescriptionStates[compareJobFilename] ? compareJobContent.details : null,
            firstSuccessful?.metadata?.retrieval?.evidenceByQuestion as any[] | undefined
          );
          if (parsed?.length > 0) {
            employerQuestionsStore.setParsedAnswers(parsed);
          }
        }
      }
      employerQuestionsStore.finishComparison();
      if (stateAfterStream?.comparisonResults) {
        await saveComparisonResults(compareJob, stateAfterStream.comparisonResults);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Comparison cancelled');
      } else {
        console.error('Failed to compare answers:', error);
        alert('Failed to compare: ' + error.message);
      }
      employerQuestionsStore.finishComparison();
    }
  }

  async function saveComparisonResults(job, results) {
    if (!job || !results) return;

    try {
      await fetch('/api/save-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'employer-questions-comparison',
          company: job.company,
          title: job.title,
          jobFilename: job.filename,
          response: JSON.stringify(results)
        })
      });
      // Update the set to reflect this job now has a saved response
      jobsWithSavedResponses = new Set([...jobsWithSavedResponses, job.filename]);
    } catch (error) {
      console.error('Failed to save response:', error);
    }
  }

  /** Load saved comparison for this job and populate store so UI and KB show this job's results only. */
  async function loadLastResponse(job: typeof selectedJob, content: typeof jobContent, requestId?: number) {
    if (!job?.filename) return;
    if (requestId && requestId !== latestJobSelectionRequest) return;

    try {
      const response = await fetch(
        `/api/save-response?type=employer-questions-comparison&jobFilename=${encodeURIComponent(job.filename)}`
      );
      const data = await response.json();
      if (requestId && requestId !== latestJobSelectionRequest) return;

      if (!data.success || !data.data?.response) return;

      const savedResults = JSON.parse(data.data.response);
      const questions = content?.questions;
      const hasQuestions = Array.isArray(questions) && questions.length > 0;
      if (requestId && requestId !== latestJobSelectionRequest) return;

      // Keep store pointed at this job and set comparison results
      employerQuestionsStore.startComparison(job.filename);

      if (typeof savedResults === 'object' && !Array.isArray(savedResults)) {
        Object.entries(savedResults).forEach(([providerId, result]) => {
          const r = result as any;
          employerQuestionsStore.updateComparisonResult(providerId, {
            ...r,
            text: r.text || r.answer || r.error || '',
            error: r.success === false ? (r.error || 'Unknown error') : undefined
          });
        });

        if (hasQuestions) {
          const allSavedResults = Object.values(savedResults);
          const firstSuccessfulResult = allSavedResults.find((r: any) =>
            r && (r.text || r.answer) && !r.error && r.success !== false
          );
          const answerText = firstSuccessfulResult?.text ?? firstSuccessfulResult?.answer;
          if (answerText) {
            const parsed = await parseAIAnswersWithSources(
              answerText,
              questions,
              jobDescriptionStates[job.filename] ? content.details : null,
              firstSuccessfulResult?.metadata?.retrieval?.evidenceByQuestion as any[] | undefined
            );
            if (requestId && requestId !== latestJobSelectionRequest) return;
            if (parsed?.length > 0) {
              employerQuestionsStore.setParsedAnswers(parsed);
            }
          }
        }
      }

      employerQuestionsStore.finishComparison();
    } catch (error) {
      console.log('No saved response for this job', error);
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }

  async function parseAIAnswersWithSources(
    aiResponse: string,
    questions: any[],
    jobDescription: string | null,
    retrievalEvidenceByQuestion?: any[]
  ): Promise<ParsedAnswer[]> {
    try {
      // First parse the basic answers
      const answers = parseAIAnswers(aiResponse);
      if (answers.length === 0) {
        return [];
      }

      // Fetch required data for source matching
      const [genericQuestions, resumeText] = await Promise.all([
        fetchGenericQuestions(),
        fetchResumeText()
      ]);

      const getQuestionText = (q: any): string => String(q?.q ?? q?.question ?? q?.text ?? '');
      // Match sources for each answer
      const answersWithSources: AnswerWithReferences[] = answers.map((answer, index) => {
        const question = questions[index];
        if (!question) {
          return { answer, sources: [] };
        }

        const sources = findAnswerSources(
          getQuestionText(question),
          answer,
          genericQuestions,
          resumeText,
          jobDescription
        );

        const ragEvidence = Array.isArray(retrievalEvidenceByQuestion?.[index])
          ? retrievalEvidenceByQuestion?.[index]
          : [];
        const ragSources = ragEvidence.map((item: any) => ({
          type: 'rag_chunk' as const,
          reference: `Retrieved (${item?.docType || 'document'})`,
          chunkId: typeof item?.chunkId === 'string' ? item.chunkId : undefined,
          docId: typeof item?.docId === 'string' ? item.docId : undefined,
          score: typeof item?.score === 'number' ? item.score : undefined,
          reason: typeof item?.reason === 'string' ? item.reason : undefined,
          docType: typeof item?.docType === 'string' ? item.docType : undefined,
          excerpt: typeof item?.snippet === 'string' ? item.snippet : undefined
        }));

        return {
          answer,
          sources: [...ragSources, ...sources]
        };
      });

      return answersWithSources;
    } catch (error) {
      console.error('Error parsing AI answers with sources:', error);
      // Fallback to parsed answers with empty sources
      return parseAIAnswers(aiResponse).map((answer) => ({ answer, sources: [] }));
    }
  }

  async function fetchGenericQuestions(): Promise<GenericQuestion[]> {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) return [];

      const response = await fetch('/api/generic-questions', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const list = data.data?.questions ?? data.questions ?? [];
        return Array.isArray(list) ? list : [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch generic questions:', error);
      return [];
    }
  }

  async function fetchResumeText(): Promise<string | null> {
    console.warn('Legacy upload is disabled. Resume text must come from FinalBoss managed storage.');
    return null;
  }

  function parseAIAnswers(aiResponse: string): (string | number | number[])[] {
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

  /** Employer question numbers (1-based) that used this generic Q&A as a source */
  function getEmployerQuestionIndicesForGenericQuestion(gq: GenericQuestion): number[] {
    const rawId = gq._id as unknown;
    const id = typeof rawId === 'string'
      ? rawId
      : (rawId as { $oid?: string })?.$oid ?? (rawId as { toString?: () => string })?.toString?.() ?? '';
    const indices: number[] = [];
    if (!effectiveParsedAnswers.length) return indices;
    effectiveParsedAnswers.forEach((answerData, index) => {
      const sources = getAnswerSources(answerData);
      if (sources?.some((s) => s.type === 'generic_question' && (s.matchDetails?.genericQuestionId ?? '') === id)) {
        indices.push(index + 1);
      }
    });
    return indices;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  function formatJSON(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  function getRawQuestionsJSON(): string {
    if (!jobContent || !jobContent.questions) return '{}';
    return formatJSON({ questions: jobContent.questions });
  }

  function getRawAPIResponseJSON(): string {
    const results = $employerQuestionsStore.comparisonResults;
    if (!results) return '{}';
    return formatJSON(results);
  }

  function getSelectedProviderResult() {
    const results = $employerQuestionsStore.comparisonResults;
    if (!results) return null;
    
    // Find the first successful result
    const allResults = Object.values(results);
    const firstSuccessful = allResults.find((r: any) => {
      return r && (r.text || r.answer) && !r.error && r.success !== false;
    });
    
    return firstSuccessful as any;
  }

  function getProviderNameForResult(result: any): string {
    if (!result) return '';
    const results = $employerQuestionsStore.comparisonResults;
    if (!results) return '';
    
    const entry = Object.entries(results).find(([_, r]: [string, any]) => r === result);
    if (!entry) return '';
    
    return getProviderName(entry[0]);
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

  /** Truncate long result text for display to avoid DOM/memory spikes and crashes during streaming */
  const DISPLAY_TEXT_MAX = 4000;
  function truncateForDisplay(text) {
    if (text == null || typeof text !== 'string') return { display: '', truncated: false };
    if (text.length <= DISPLAY_TEXT_MAX) return { display: text, truncated: false };
    return {
      display: text.slice(0, DISPLAY_TEXT_MAX) + '\n\n… (truncated — use Copy for full)',
      truncated: true
    };
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

  function cancelGeneration() {
    employerQuestionsStore.cancelGeneration();
  }

  function clearResults() {
    if (confirm('Clear all results? This will not delete saved responses.')) {
      employerQuestionsStore.clearResults();
    }
  }

  async function refreshKbHighlightsForCurrentJob() {
    const job = selectedJob;
    const content = jobContent;
    if (!job?.filename || !content?.questions?.length) return;
    if ($employerQuestionsStore.selectedJobFilename !== job.filename) return;

    try {
      genericQuestionsList = await fetchGenericQuestions();
    } catch (error) {
      console.error('Failed to refresh generic questions for KB:', error);
    }

    const results = $employerQuestionsStore.comparisonResults;
    if (!results || $employerQuestionsStore.selectedJobFilename !== job.filename) return;

    const allResults = Object.values(results);
    const firstSuccessful = allResults.find((r: any) => {
      const t = r?.text ?? r?.answer;
      return r && t && !r.error && r.success !== false;
    }) as any;
    const answerText = firstSuccessful?.text ?? firstSuccessful?.answer;
    if (!answerText) return;

    const parsed = await parseAIAnswersWithSources(
      answerText,
      content.questions,
      jobDescriptionStates[job.filename] ? content.details : null,
      firstSuccessful?.metadata?.retrieval?.evidenceByQuestion as any[] | undefined
    );
    if ($employerQuestionsStore.selectedJobFilename !== job.filename) return;
    if (parsed?.length > 0) {
      employerQuestionsStore.setParsedAnswers(parsed);
    }
  }

  async function toggleKbPanel() {
    const nextOpen = !kbPanelOpen;
    kbPanelOpen = nextOpen;
    if (nextOpen) {
      await refreshKbHighlightsForCurrentJob();
    }
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
	<div class="page-header">
		<div>
			<h1 class="text-4xl font-bold mb-4 text-primary">❓ Employer Questions</h1>
			<p class="text-base-content/70">Get AI-powered recommendations for employer screening questions</p>
		</div>
		<button
			type="button"
			class="kb-full-column-btn"
			on:click={toggleKbPanel}
			title={kbPanelOpen ? 'Hide Knowledge base panel' : 'Show Knowledge base panel'}
		>
			📋 KB
		</button>
	</div>

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
						bind:textContent={employerQuestionsPrompt}
						on:input={onPromptChange}
					>{employerQuestionsPrompt}</pre>
				{:else}
					<textarea
						class="prompt-editor"
						bind:value={employerQuestionsPrompt}
						placeholder="Enter your AI prompt here..."
						rows="10"
						on:input={onPromptChange}
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
					<div class="q-and-a-layout" class:full-column={kbFullColumnOpen}>
					<div class="content-section">
						<!-- View Toggle Buttons -->
						<div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(128, 128, 128, 0.05); border-radius: 8px; border: 1px solid rgba(128, 128, 128, 0.2);">
							<button
								class="view-toggle-btn"
								class:active={viewMode === 'raw'}
								on:click={() => viewMode = 'raw'}
							>
								📄 Raw Data
							</button>
							<button
								class="view-toggle-btn"
								class:active={viewMode === 'api'}
								on:click={() => viewMode = 'api'}
								disabled={!comparisonResults}
							>
								🔌 API Response
							</button>
							<button
								class="view-toggle-btn"
								class:active={viewMode === 'readable'}
								on:click={() => viewMode = 'readable'}
							>
								📖 Easy Read
							</button>
						</div>

						<!-- RAW DATA VIEW -->
						{#if viewMode === 'raw'}
							<div class="view-section">
								<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
									<h3 style="margin: 0; font-size: 1.5rem;">📄 Raw Questions Data</h3>
									<div style="display: flex; gap: 0.5rem;">
										<button
											class="copy-btn-small"
											on:click={() => copyToClipboard(getRawQuestionsJSON())}
										>
											📋 Copy JSON
										</button>
										<button
											class="toggle-btn-small"
											on:click={() => rawDataExpanded = !rawDataExpanded}
										>
											{rawDataExpanded ? '▼ Collapse' : '▶ Expand'}
										</button>
									</div>
								</div>
								{#if rawDataExpanded}
									<pre class="json-display">{getRawQuestionsJSON()}</pre>
								{/if}
							</div>
						{/if}

						<!-- API RESPONSE VIEW -->
						{#if viewMode === 'api'}
							<div class="view-section">
								{#if !comparisonResults}
									<div style="padding: 2rem; text-align: center; color: rgba(128, 128, 128, 0.7);">
										<p>No API response yet. Click "Compare AI Answers" to see results.</p>
									</div>
								{:else}
									<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
										<h3 style="margin: 0; font-size: 1.5rem;">🔌 Raw API Response</h3>
										<div style="display: flex; gap: 0.5rem;">
											<button
												class="copy-btn-small"
												on:click={() => copyToClipboard(getRawAPIResponseJSON())}
											>
												📋 Copy JSON
											</button>
											<button
												class="toggle-btn-small"
												on:click={() => apiResponseExpanded = !apiResponseExpanded}
											>
												{apiResponseExpanded ? '▼ Collapse' : '▶ Expand'}
											</button>
										</div>
									</div>
									{#if apiResponseExpanded}
										<pre class="json-display">{getRawAPIResponseJSON()}</pre>
									{/if}
								{/if}
							</div>
						{/if}

						<!-- EASY READ VIEW -->
						{#if viewMode === 'readable'}
							<div class="view-section">
								<!-- AI Comparison Results Summary -->
								{#if comparisonResults && comparisonResults.length > 0}
									<div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(0, 128, 128, 0.05); border-radius: 12px; border: 2px solid teal;">
										<h3 style="margin: 0 0 1rem 0; font-size: 1.5rem;">🔍 AI Comparison Results</h3>
										<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
											{#each comparisonResults.filter(result => providers.some(p => p.id === result.providerId)) as result}
												<div style="background: rgba(128, 128, 128, 0.05); border: 2px solid {result.error ? 'red' : 'teal'}; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column;">
													<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid {result.error ? 'red' : 'teal'};">
														<h4 style="margin: 0; font-size: 1.2rem;">{getProviderIcon(result.providerId)} {getProviderName(result.providerId)}</h4>
														{#if result.error}
															<span style="background: rgba(255, 0, 0, 0.2); color: red; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">❌ Error</span>
														{:else}
															<span style="background: rgba(0, 128, 128, 0.2); color: teal; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">✅ Success</span>
														{/if}
													</div>
													{#if !result.error}
														<div style="flex: 1; margin-bottom: 1rem;">
															<pre style="background: rgba(0, 0, 0, 0.05); padding: 1rem; border-radius: 8px; font-size: 0.9rem; white-space: pre-wrap; word-wrap: break-word; margin: 0; border: 1px solid rgba(128, 128, 128, 0.2);">{truncateForDisplay(result.text).display}</pre>
														</div>
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
													{#if result.metadata}
														<div style="border-top: 1px solid rgba(128, 128, 128, 0.3); padding-top: 1rem; font-size: 0.85rem; opacity: 0.8;">
															<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
																<span>⏱️ Time:</span>
																<span style="font-weight: 600;">{formatTime(result.metadata.processingTime)}</span>
															</div>
															{#if result.metadata.tokensUsed}
																<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
																	<span>🎯 Tokens:</span>
																	<span style="font-weight: 600;">{result.metadata.tokensUsed.toLocaleString()}</span>
																</div>
															{/if}
															<div style="display: flex; justify-content: space-between;">
																<span>🤖 Model:</span>
																<span style="font-family: monospace; font-size: 0.75rem;">{result.metadata.model}</span>
															</div>
															{#if result.metadata?.retrieval?.retrievalStats}
																<div style="display: flex; justify-content: space-between; margin-top: 0.4rem;">
																	<span>📚 Retrieval:</span>
																	<span style="font-size: 0.75rem;">
																		{result.metadata.retrieval.retrievalStats.questionCount || 0} q
																		• topK {result.metadata.retrieval.retrievalStats.topK || 0}
																	</span>
																</div>
															{/if}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Simple Q&A: index, question, type, options list. No auto-selection. -->
								<div class="job-description-section">
									<div class="questions-header-row">
										<h3 style="margin: 0; font-size: 1.5rem;">📋 Questions — {selectedJob.company}</h3>
										<button
											type="button"
											class="kb-panel-toggle"
											on:click={toggleKbPanel}
											title={kbPanelOpen ? 'Hide Knowledge base panel' : 'Show Knowledge base panel'}
										>
											{#if kbPanelOpen}
												<span>📋 Knowledge base</span> <span class="kb-panel-toggle-arrow">▼</span>
											{:else}
												<span>📋 Knowledge base</span> <span class="kb-panel-toggle-arrow">▶</span>
											{/if}
										</button>
									</div>

									<div style="display: flex; flex-direction: column; gap: 1.25rem;">
										{#each jobContent.questions as question, index}
											<div style="background: rgba(128, 128, 128, 0.06); border: 1px solid rgba(128, 128, 128, 0.25); border-radius: 8px; padding: 1rem;">
												<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
													<span style="font-weight: 700; font-size: 0.9rem;">Q{index + 1}</span>
													<span style="font-size: 0.75rem; color: rgba(128, 128, 128, 0.9);">({question.type || 'select'})</span>
												</div>
												<p style="margin: 0 0 0.75rem 0; font-size: 0.95rem; line-height: 1.4;">{question.q}</p>

												{#if question.type === 'text'}
													<p style="margin: 0; font-size: 0.85rem; color: rgba(128, 128, 128, 0.85);">Text input — no options</p>
												{:else if question.opts && question.opts.length > 0}
													<p style="margin: 0 0 0.25rem 0; font-size: 0.8rem; opacity: 0.8;">Options:</p>
													<ul style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.5;">
														{#each question.opts as option, optIndex}
															<li><strong>{optIndex}.</strong> {option}</li>
														{/each}
													</ul>
												{:else}
													<p style="margin: 0; font-size: 0.85rem; color: rgba(128, 128, 128, 0.85);">No options</p>
												{/if}

												{#if effectiveParsedAnswers.length > index}
													{@const answerData = effectiveParsedAnswers[index]}
													{@const answer = getAnswerValue(answerData)}
													{@const sources = getAnswerSources(answerData)}
													<div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(0, 128, 128, 0.08); border-radius: 4px; font-size: 0.9rem;">
														{#if question.type === 'text'}
															<span style="color: teal;">AI: </span>{typeof answer === 'string' ? answer : String(answer)}
														{:else if Array.isArray(answer)}
															<span style="color: teal;">AI: </span>[{answer.join(', ')}]
														{:else}
															<span style="color: teal;">AI: </span>{answer}
														{/if}
													</div>
													{#if sources && sources.length > 0}
														<div style="margin-top: 0.5rem; padding: 0.65rem 0.75rem; background: rgba(0, 128, 128, 0.06); border-left: 3px solid teal; border-radius: 4px; font-size: 0.85rem;">
															<p style="margin: 0 0 0.5rem 0; font-weight: 700; color: teal;">✓ Why this answer is valid</p>
															<p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: rgba(0,0,0,0.65);">Answer extracted from:</p>
															<div style="display: flex; flex-direction: column; gap: 0.6rem;">
																{#each sources as source}
																	{#if source.type === 'rag_chunk'}
																		<div style="border-radius: 6px; overflow: hidden; border: 1px solid rgba(244, 114, 182, 0.45); background: rgba(244, 114, 182, 0.07);">
																			<div style="padding: 0.35rem 0.5rem; font-weight: 700; font-size: 0.8rem; color: #be185d; background: rgba(244, 114, 182, 0.14);">🧩 Retrieved chunk evidence</div>
																			<div style="padding: 0 0.5rem 0.25rem; font-size: 0.78rem; color: rgba(0,0,0,0.7);">
																				{source.docType || 'document'}{#if source.score != null} • score {source.score}{/if}
																			</div>
																			{#if source.reason}
																				<div style="padding: 0 0.5rem 0.25rem; font-size: 0.78rem; color: rgba(0,0,0,0.65);">{source.reason}</div>
																			{/if}
																			{#if source.excerpt}
																				<div class="answer-excerpt-highlight" style="margin: 0.35rem 0.5rem 0.5rem; padding: 0.45rem 0.5rem; background: rgba(255, 235, 59, 0.35); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid #b45309;">{source.excerpt.length > 240 ? source.excerpt.slice(0, 240) + '…' : source.excerpt}</div>
																			{/if}
																		</div>
																	{:else if source.type === 'generic_question'}
																		<div style="border-radius: 6px; overflow: hidden; border: 1px solid rgba(124, 58, 237, 0.4); background: rgba(124, 58, 237, 0.06);">
																			<div style="padding: 0.35rem 0.5rem; font-weight: 700; font-size: 0.8rem; color: #5b21b6; background: rgba(124, 58, 237, 0.12);">📋 From generic Q&A</div>
																			{#if source.reference}<div style="padding: 0 0.5rem 0.25rem; font-size: 0.8rem;">{source.reference}</div>{/if}
																			{#if source.matchDetails?.matchedKeywords?.length}
																				<div style="padding: 0 0.5rem; font-size: 0.75rem; color: rgba(0,0,0,0.6);">Matched keywords: {source.matchDetails.matchedKeywords.join(', ')}</div>
																			{/if}
																			{#if source.excerpt}
																				<div class="answer-excerpt-highlight" style="margin: 0.35rem 0.5rem 0.5rem; padding: 0.45rem 0.5rem; background: rgba(255, 235, 59, 0.35); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid #b45309;">{source.excerpt.length > 200 ? source.excerpt.slice(0, 200) + '…' : source.excerpt}</div>
																			{/if}
																		</div>
																	{:else if source.type === 'resume'}
																		<div style="border-radius: 6px; overflow: hidden; border: 1px solid rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.06);">
																			<div style="padding: 0.35rem 0.5rem; font-weight: 700; font-size: 0.8rem; color: #1d4ed8; background: rgba(59, 130, 246, 0.12);">📄 From resume</div>
																			{#if source.reference}<div style="padding: 0 0.5rem 0.25rem; font-size: 0.8rem;">{source.reference}</div>{/if}
																			{#if source.excerpt}
																				<div class="answer-excerpt-highlight" style="margin: 0.35rem 0.5rem 0.5rem; padding: 0.45rem 0.5rem; background: rgba(255, 235, 59, 0.35); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid #b45309;">{source.excerpt.length > 200 ? source.excerpt.slice(0, 200) + '…' : source.excerpt}</div>
																			{/if}
																		</div>
																	{:else if source.type === 'job_description'}
																		<div style="border-radius: 6px; overflow: hidden; border: 1px solid rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.06);">
																			<div style="padding: 0.35rem 0.5rem; font-weight: 700; font-size: 0.8rem; color: #15803d; background: rgba(34, 197, 94, 0.12);">💼 From job description</div>
																			{#if source.reference}<div style="padding: 0 0.5rem 0.25rem; font-size: 0.8rem;">{source.reference}</div>{/if}
																			{#if source.excerpt}
																				<div class="answer-excerpt-highlight" style="margin: 0.35rem 0.5rem 0.5rem; padding: 0.45rem 0.5rem; background: rgba(255, 235, 59, 0.35); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid #b45309;">{source.excerpt.length > 200 ? source.excerpt.slice(0, 200) + '…' : source.excerpt}</div>
																			{/if}
																		</div>
																	{:else}
																		<div style="border-radius: 6px; overflow: hidden; border: 1px solid rgba(0, 128, 128, 0.4); background: rgba(0, 128, 128, 0.06);">
																			<div style="padding: 0.35rem 0.5rem; font-weight: 700; font-size: 0.8rem; color: teal; background: rgba(0, 128, 128, 0.12);">🧠 From knowledge base (inferred)</div>
																			{#if source.reference}<div style="padding: 0 0.5rem 0.25rem; font-size: 0.8rem;">{source.reference}</div>{/if}
																			{#if source.excerpt}
																				{@const parts = source.excerpt.split('\n---\n')}
																				{@const kbSection = (parts[0] || '').trim()}
																				{@const contextSection = (parts[1] || '').trim()}
																				<div style="margin: 0.35rem 0.5rem 0.5rem;">
																					{#if kbSection}
																						<div style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.35rem; color: #0d9488;">Knowledge base — questions & answers used:</div>
																						<div style="padding: 0.5rem; background: rgba(255, 235, 59, 0.25); border-radius: 4px; font-size: 0.8rem; white-space: pre-wrap; word-break: break-word; max-height: 18rem; overflow-y: auto; border: 1px solid rgba(0,128,128,0.2); border-left: 3px solid #b45309;">{kbSection}</div>
																					{/if}
																					{#if contextSection}
																						<div style="font-weight: 600; font-size: 0.75rem; margin: {kbSection ? '0.5rem 0 0.25rem' : '0'}; color: rgba(0,0,0,0.6);">Also in context:</div>
																						<div style="padding: 0.4rem 0.5rem; background: rgba(0,0,0,0.04); border-radius: 4px; font-size: 0.75rem; white-space: pre-wrap; word-break: break-word;">{contextSection.length > 600 ? contextSection.slice(0, 600) + '…' : contextSection}</div>
																					{/if}
																				</div>
																			{/if}
																		</div>
																	{/if}
																{/each}
															</div>
														</div>
													{/if}
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>

					{#if kbFullColumnOpen}
						<aside class="kb-sidebar kb-sidebar-column">
							<h3 class="kb-sidebar-title">📋 Knowledge base</h3>
							{#if genericQuestionsList.length === 0}
								<p class="kb-sidebar-empty">No generic Q&A. Add some in <a href="/generic-questions">Generic Q&A</a> and refresh.</p>
							{:else}
								<p class="kb-sidebar-hint">Matched entries show which employer question used them.</p>
								<div class="kb-list">
									{#each genericQuestionsList.filter(gq => gq.isActive !== false) as gq}
										{@const usedFor = getEmployerQuestionIndicesForGenericQuestion(gq)}
										{@const matched = usedFor.length > 0}
										<div class="kb-item" class:kb-item-matched={matched}>
											<div class="kb-item-header">
												{#if matched}
													<span class="kb-badge">✓ Used for Q{usedFor.join(', Q')}</span>
												{/if}
												<span class="kb-item-keywords">Match: {(gq.match_keywords || []).join(', ')}</span>
											</div>
											<div class="kb-item-answers">A: {(gq.answers || []).join(' OR ')}</div>
										</div>
									{/each}
								</div>
							{/if}
						</aside>
					{/if}
					</div>
				{:else}
					<div class="loading">Loading questions...</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Knowledge base slide-over drawer (always in DOM so top-right KB button works) -->
	<div class="kb-drawer-backdrop" class:open={kbPanelOpen} on:click={() => kbPanelOpen = false} on:keydown={(e) => e.key === 'Escape' && (kbPanelOpen = false)} role="button" tabindex="-1" aria-label="Close drawer"></div>
	<aside class="kb-drawer" class:open={kbPanelOpen}>
		<div class="kb-drawer-header">
			<h3 class="kb-sidebar-title">📋 Knowledge base</h3>
			<button type="button" class="kb-drawer-close" on:click={() => kbPanelOpen = false} aria-label="Close">×</button>
		</div>
		<div class="kb-drawer-body">
			{#if genericQuestionsList.length === 0}
				<p class="kb-sidebar-empty">No generic Q&A. Add some in <a href="/generic-questions">Generic Q&A</a> and refresh.</p>
			{:else}
				<p class="kb-sidebar-hint">Matched entries show which employer question used them.</p>
				<div class="kb-list">
					{#each genericQuestionsList.filter(gq => gq.isActive !== false) as gq}
						{@const usedFor = getEmployerQuestionIndicesForGenericQuestion(gq)}
						{@const matched = usedFor.length > 0}
						<div class="kb-item" class:kb-item-matched={matched}>
							<div class="kb-item-header">
								{#if matched}
									<span class="kb-badge">✓ Used for Q{usedFor.join(', Q')}</span>
								{/if}
								<span class="kb-item-keywords">Match: {(gq.match_keywords || []).join(', ')}</span>
							</div>
							<div class="kb-item-answers">A: {(gq.answers || []).join(' OR ')}</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</aside>
</main>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-header .kb-full-column-btn {
    flex-shrink: 0;
    margin-top: 0.25rem;
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

  /* View Toggle Styles */
  .view-toggle-btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid rgba(128, 128, 128, 0.3);
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
    transition: all 0.2s;
    color: rgba(0, 0, 0, 0.7);
  }

  .view-toggle-btn:hover:not(:disabled) {
    border-color: teal;
    background: rgba(0, 128, 128, 0.05);
    transform: translateY(-1px);
  }

  .view-toggle-btn.active {
    background: teal;
    color: white;
    border-color: teal;
  }

  .view-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* View Section Styles */
  .view-section {
    margin-bottom: 2rem;
  }

  /* JSON Display Styles */
  .json-display {
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 8px;
    padding: 1.5rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    overflow-x: auto;
    white-space: pre;
    max-height: 600px;
    overflow-y: auto;
  }

  /* Button Styles */
  .copy-btn-small, .toggle-btn-small {
    padding: 0.5rem 1rem;
    border: 1px solid rgba(128, 128, 128, 0.3);
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .copy-btn-small:hover {
    background: rgba(0, 128, 128, 0.05);
    border-color: teal;
  }

  .toggle-btn-small:hover {
    background: rgba(128, 128, 128, 0.05);
  }

  .questions-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .kb-panel-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #5b21b6;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .kb-panel-toggle:hover {
    background: rgba(124, 58, 237, 0.18);
    border-color: rgba(124, 58, 237, 0.5);
  }

  .kb-panel-toggle-arrow {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  .kb-full-column-btn {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #5b21b6;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .kb-full-column-btn:hover {
    background: rgba(124, 58, 237, 0.18);
    border-color: rgba(124, 58, 237, 0.5);
  }

  .q-and-a-layout {
    display: block;
    min-height: 0;
  }

  .q-and-a-layout.full-column {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .q-and-a-layout.full-column .content-section {
    flex: 1;
    min-width: 0;
  }

  .kb-sidebar-column {
    flex-shrink: 0;
    width: 300px;
    max-height: calc(100vh - 12rem);
    overflow-y: auto;
    padding: 1rem;
    background: rgba(124, 58, 237, 0.06);
    border: 1px solid rgba(124, 58, 237, 0.25);
    border-radius: 10px;
  }

  .kb-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.25);
    z-index: 40;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .kb-drawer-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }

  .kb-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    max-width: 90vw;
    height: 100vh;
    z-index: 50;
    background: #fff;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease-out;
  }

  .kb-drawer.open {
    transform: translateX(0);
  }

  .kb-drawer-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0.75rem;
    border-bottom: 1px solid rgba(124, 58, 237, 0.2);
    background: rgba(124, 58, 237, 0.06);
  }

  .kb-drawer-close {
    width: 2rem;
    height: 2rem;
    border: none;
    background: rgba(128, 128, 128, 0.2);
    border-radius: 6px;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.7);
  }

  .kb-drawer-close:hover {
    background: rgba(128, 128, 128, 0.3);
  }

  .kb-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .kb-sidebar-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #5b21b6;
  }

  .kb-sidebar-hint {
    margin: 0 0 0.75rem 0;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.55);
  }

  .kb-sidebar-empty {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(0, 0, 0, 0.6);
  }

  .kb-sidebar-empty a {
    color: #5b21b6;
    text-decoration: underline;
  }

  .kb-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .kb-item {
    padding: 0.5rem 0.6rem;
    border-radius: 6px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
  }

  .kb-item-matched {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.12);
  }

  .kb-item-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.25rem;
  }

  .kb-badge {
    background: #22c55e;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .kb-item-keywords {
    font-weight: 600;
    color: rgba(0, 0, 0, 0.85);
  }

  .kb-item-answers {
    font-size: 0.8rem;
    color: rgba(0, 0, 0, 0.75);
  }
</style>
</AdminGuard>
