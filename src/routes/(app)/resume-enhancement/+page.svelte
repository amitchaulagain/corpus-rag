<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  interface Enhancement {
    section: string;
    original: string;
    enhanced: string;
    reason: string;
    impact: 'high' | 'medium' | 'low';
  }

  interface EnhancementResult {
    originalFitScore: number;
    enhancedFitScore: number;
    improvements: Enhancement[];
    atsKeywords: {
      added: string[];
      optimized: string[];
    };
    summary: string;
    enhancedResume: string;
  }

  let user: any = null;
  let jobs: any[] = [];
  let selectedJob: any = null;
  let jobContent: any = null;
  let enhancement: EnhancementResult | null = null;
  let isLoading = false;
  let isEnhancing = false;
  let enhancementFocus = 'ats';

  const focusOptions = [
    { value: 'ats', label: '🤖 ATS Optimization', description: 'Optimize for Applicant Tracking Systems' },
    { value: 'skills', label: '🎯 Skills Matching', description: 'Highlight relevant skills and experience' },
    { value: 'keywords', label: '🔑 Keyword Enhancement', description: 'Add industry-specific keywords' },
    { value: 'experience', label: '💼 Experience Boost', description: 'Strengthen experience descriptions' }
  ];

  onMount(() => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
    }
  });

  async function loadJobs() {
    if (!user) return;

    isLoading = true;
    try {
      const response = await apiRequest('/api/jobs');
      const data = await response.json();

      if (data.success) {
        jobs = (data.data.jobs || []).filter((job: any) => job.hasJobDetails);
      } else {
        console.error('Failed to load jobs:', data.error);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      isLoading = false;
    }
  }

  async function selectJob(job: any) {
    if (job.type === 'error') return;

    selectedJob = job;
    jobContent = null;
    enhancement = null;

    try {
      const response = await apiRequest(`/api/jobs/${job.filename}`);
      const data = await response.json();

      if (data.success) {
        jobContent = data.data.content;
      } else {
        console.error('Failed to load job details:', data.error);
      }
    } catch (error) {
      console.error('Failed to load job details:', error);
    }
  }

  async function enhanceResume() {
    if (!selectedJob || !jobContent || !user) return;

    isEnhancing = true;
    try {
      const focusOption = focusOptions.find(opt => opt.value === enhancementFocus);
      const response = await apiRequest('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'resume_enhancement',
          jobDetails: jobContent,
          userEmail: user.email,
          enhancementFocus: enhancementFocus,
          customPrompt: `Enhance my resume for this specific job posting with focus on ${focusOption?.label}.

Please provide:

1. **Original vs Enhanced Fit Score**: Calculate fit scores before and after enhancement (0-100%)

2. **Specific Improvements**: For each section that needs enhancement, provide:
   - Section name (Summary, Experience, Skills, etc.)
   - Original text
   - Enhanced version
   - Reason for change
   - Impact level (high/medium/low)

3. **ATS Optimization**:
   - Keywords added for ATS scanning
   - Formatting improvements
   - Skills alignment with job requirements

4. **Enhanced Resume**: Complete enhanced resume text

Focus areas based on selection:
- ATS Optimization: Keyword density, formatting, ATS-friendly structure
- Skills Matching: Highlight relevant technical and soft skills
- Keyword Enhancement: Industry-specific terminology and buzzwords
- Experience Boost: Quantify achievements, use action verbs, show impact

Provide specific, actionable enhancements with clear before/after comparisons.`
        })
      });

      const data = await response.json();

      if (data.success) {
        enhancement = parseEnhancementResponse(data.data.generatedText);
      } else {
        console.error('Failed to enhance resume:', data.error);
      }
    } catch (error) {
      console.error('Failed to enhance resume:', error);
    } finally {
      isEnhancing = false;
    }
  }

  function parseEnhancementResponse(text: string): EnhancementResult {
    try {
      const originalScoreMatch = text.match(/original[^0-9]*(\d+)%?/i);
      const enhancedScoreMatch = text.match(/enhanced[^0-9]*(\d+)%?/i);

      const originalFitScore = originalScoreMatch ? parseInt(originalScoreMatch[1]) : 0;
      const enhancedFitScore = enhancedScoreMatch ? parseInt(enhancedScoreMatch[1]) : 0;

      const improvements: Enhancement[] = [];

      const sectionMatches = text.matchAll(/(?:section|improvement)[:\s]*([^:]+)[:\s]*\n(?:original|before)[:\s]*([^\n]+)\n(?:enhanced|after)[:\s]*([^\n]+)\n(?:reason|why)[:\s]*([^\n]+)/gi);
      for (const match of sectionMatches) {
        improvements.push({
          section: match[1].trim(),
          original: match[2].trim(),
          enhanced: match[3].trim(),
          reason: match[4].trim(),
          impact: 'medium' as const
        });
      }

      const atsKeywords = {
        added: [] as string[],
        optimized: [] as string[]
      };

      const keywordMatches = text.matchAll(/(?:keyword|ats)[:\s]*([^\n]+)/gi);
      for (const match of keywordMatches) {
        const keywords = match[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
        atsKeywords.added.push(...keywords);
      }

      let enhancedResume = '';
      const resumeMatch = text.match(/(?:enhanced resume|complete resume)[:\s]*\n([\s\S]+?)(?:\n\n|\n##|\n###|$)/i);
      if (resumeMatch) {
        enhancedResume = resumeMatch[1].trim();
      }

      let summary = '';
      const summaryMatch = text.match(/(?:summary|overview)[:\s]*\n([^\n]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }

      if (improvements.length === 0 && !enhancedResume) {
        enhancedResume = text;
        summary = 'AI-generated resume enhancement based on job requirements';
      }

      return {
        originalFitScore,
        enhancedFitScore,
        improvements,
        atsKeywords,
        summary,
        enhancedResume
      };
    } catch (error) {
      console.warn('Failed to parse enhancement response, using raw text:', error);
      return {
        originalFitScore: 0,
        enhancedFitScore: 0,
        improvements: [],
        atsKeywords: { added: [], optimized: [] },
        summary: 'AI-generated resume enhancement',
        enhancedResume: text
      };
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  function downloadEnhancedResume() {
    if (!enhancement) return;

    const blob = new Blob([enhancement.enhancedResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-resume-${selectedJob?.company || 'job'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<main class="container mx-auto max-w-6xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">✨ Resume Enhancement</h1>
    <p class="text-base-content/70">ATS optimization and tailored resume improvements for specific jobs</p>
  </div>

  <div class="main-content">
    <!-- Jobs Sidebar -->
    <div class="jobs-sidebar">
      <div class="sidebar-header">
        <h2>💼 Jobs with Descriptions ({jobs.length})</h2>
        <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
          {#if isLoading}⏳{:else}🔄{/if}
        </button>
      </div>

      {#if isLoading}
        <div class="loading">Loading jobs...</div>
      {:else if jobs.length === 0}
        <div class="empty-state">
          <p>No job descriptions found</p>
        </div>
      {:else}
        <div class="jobs-list">
          {#each jobs as job}
            <div
              class="job-item"
              class:selected={selectedJob?.filename === job.filename}
              on:click={() => selectJob(job)}
              role="button"
              tabindex="0"
              on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectJob(job); } }}
            >
              <div class="job-header">
                <span class="job-type">💼 Job</span>
                <span class="job-size">{formatFileSize(job.size)}</span>
              </div>
              <h3 class="job-company">{job.company}</h3>
              <p class="job-title">{job.title}</p>
              {#if job.location}
                <p class="job-location">📍 {job.location}</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Enhancement Focus -->
      {#if selectedJob}
        <div class="focus-section">
          <h3>🎯 Enhancement Focus</h3>
          <div class="focus-options">
            {#each focusOptions as option}
              <label class="focus-option">
                <input
                  type="radio"
                  bind:group={enhancementFocus}
                  value={option.value}
                />
                <div class="focus-label">
                  <div class="focus-title">{option.label}</div>
                  <div class="focus-desc">{option.description}</div>
                </div>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Enhancement Panel -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">✨</div>
          <h2>Select a job to enhance resume</h2>
          <p>Choose from the jobs on the left to start optimizing</p>
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
            <div class="focus-badge">
              Focus: {focusOptions.find(opt => opt.value === enhancementFocus)?.label}
            </div>
            <button
              class="generate-btn"
              on:click={enhanceResume}
              disabled={isEnhancing || !jobContent}
            >
              {#if isEnhancing}
                ⏳ Enhancing...
              {:else}
                ✨ Enhance Resume
              {/if}
            </button>
          </div>
        </div>

        {#if jobContent}
          <div class="content-section">
            {#if enhancement}
              <!-- Score Improvement -->
              <div class="score-section">
                <h3>📈 Improvement Score</h3>
                <div class="score-grid">
                  <div class="score-card">
                    <div class="score-title">Original Score</div>
                    <div class="score-value original">{enhancement.originalFitScore}%</div>
                  </div>
                  <div class="score-arrow">➡️</div>
                  <div class="score-card">
                    <div class="score-title">Enhanced Score</div>
                    <div class="score-value enhanced">{enhancement.enhancedFitScore}%</div>
                    <div class="score-desc success">
                      +{enhancement.enhancedFitScore - enhancement.originalFitScore}% improvement
                    </div>
                  </div>
                </div>
              </div>

              <!-- Improvements -->
              {#if enhancement.improvements.length > 0}
                <div class="improvements-section">
                  <h3>🔧 Specific Improvements</h3>
                  <div class="improvements-list">
                    {#each enhancement.improvements as improvement}
                      <div class="improvement-item">
                        <div class="improvement-header">
                          <h4>{improvement.section}</h4>
                          <span class="badge {improvement.impact}">{improvement.impact} impact</span>
                        </div>

                        <div class="improvement-content-grid">
                          <div>
                            <p class="label">Before:</p>
                            <div class="text-box">{improvement.original}</div>
                          </div>
                          <div>
                            <p class="label success">After:</p>
                            <div class="text-box success">{improvement.enhanced}</div>
                          </div>
                        </div>

                        <div class="improvement-reason">
                          <strong>Why:</strong> {improvement.reason}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- ATS Keywords -->
              {#if enhancement.atsKeywords.added.length > 0 || enhancement.atsKeywords.optimized.length > 0}
                <div class="keywords-section">
                  <h3>🤖 ATS Keywords Enhancement</h3>
                  <div class="keywords-grid">
                    {#if enhancement.atsKeywords.added.length > 0}
                      <div class="keywords-col">
                        <h4>✅ Keywords Added</h4>
                        <div class="keywords-tags">
                          {#each enhancement.atsKeywords.added as keyword}
                            <span class="keyword-tag added">{keyword}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    {#if enhancement.atsKeywords.optimized.length > 0}
                      <div class="keywords-col">
                        <h4>🔧 Keywords Optimized</h4>
                        <div class="keywords-tags">
                          {#each enhancement.atsKeywords.optimized as keyword}
                            <span class="keyword-tag optimized">{keyword}</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Enhanced Resume -->
              <div class="resume-section">
                <div class="resume-header">
                  <h3>📄 Enhanced Resume</h3>
                  <div class="actions">
                    <button class="copy-btn" on:click={() => copyToClipboard(enhancement?.enhancedResume || '')}>
                      📋 Copy
                    </button>
                    <button class="download-btn" on:click={downloadEnhancedResume}>
                      💾 Download
                    </button>
                  </div>
                </div>
                <div class="resume-content">
                  <pre>{enhancement.enhancedResume}</pre>
                </div>
              </div>
            {:else if isEnhancing}
              <div class="enhancing-state">
                <div class="loading-spinner">⏳</div>
                <h3>Enhancing Your Resume</h3>
                <p>Optimizing for {focusOptions.find(opt => opt.value === enhancementFocus)?.label}...</p>
              </div>
            {/if}
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
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 20px;
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

  .job-location {
    margin: 0;
    font-size: 0.8rem;
    color: #666;
  }

  /* Focus Section */
  .focus-section {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 15px;
    margin-top: 15px;
  }

  .focus-section h3 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    color: #333;
  }

  .focus-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .focus-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .focus-option:hover {
    background: #f8f9fa;
  }

  .focus-option input[type="radio"] {
    margin-top: 2px;
  }

  .focus-label {
    flex: 1;
  }

  .focus-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
  }

  .focus-desc {
    font-size: 0.75rem;
    color: #666;
  }

  /* Main Panel */
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
    text-align: right;
  }

  .focus-badge {
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 8px;
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

  .content-section {
    padding: 25px;
  }

  /* Score Section */
  .score-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 25px;
  }

  .score-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .score-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 30px;
    align-items: center;
  }

  .score-card {
    text-align: center;
  }

  .score-title {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 10px;
  }

  .score-value {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .score-value.original {
    color: #6c757d;
  }

  .score-value.enhanced {
    color: #28a745;
  }

  .score-desc {
    font-size: 0.85rem;
    color: #666;
  }

  .score-desc.success {
    color: #28a745;
  }

  .score-arrow {
    font-size: 2rem;
  }

  /* Improvements Section */
  .improvements-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 25px;
  }

  .improvements-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .improvements-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .improvement-item {
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
  }

  .improvement-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .improvement-header h4 {
    margin: 0;
    font-size: 1rem;
    color: #333;
  }

  .badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge.high {
    background: #d4edda;
    color: #155724;
  }

  .badge.medium {
    background: #fff3cd;
    color: #856404;
  }

  .badge.low {
    background: #d1ecf1;
    color: #0c5460;
  }

  .improvement-content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 15px;
  }

  .label {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: #666;
  }

  .label.success {
    color: #28a745;
  }

  .text-box {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 12px;
    font-size: 0.9rem;
  }

  .text-box.success {
    background: #f0fff4;
    border-color: #28a745;
  }

  .improvement-reason {
    font-size: 0.85rem;
    color: #666;
  }

  /* Keywords Section */
  .keywords-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 25px;
  }

  .keywords-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .keywords-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .keywords-col h4 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    color: #333;
  }

  .keywords-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .keyword-tag {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .keyword-tag.added {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .keyword-tag.optimized {
    background: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
  }

  /* Resume Section */
  .resume-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
  }

  .resume-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .resume-header h3 {
    margin: 0;
    color: #333;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .copy-btn, .download-btn {
    background: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .copy-btn:hover, .download-btn:hover {
    background: #138496;
  }

  .resume-content {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 20px;
    max-height: 400px;
    overflow-y: auto;
  }

  .resume-content pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Enhancing State */
  .enhancing-state {
    text-align: center;
    padding: 60px 40px;
    color: #666;
  }

  .loading-spinner {
    font-size: 3rem;
    margin-bottom: 20px;
  }

  .enhancing-state h3 {
    font-size: 1.3rem;
    color: #333;
    margin-bottom: 10px;
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

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
    }

    .keywords-grid, .improvement-content-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
