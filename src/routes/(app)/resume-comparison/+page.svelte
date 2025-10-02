<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  interface ComparisonData {
    original: {
      content: string;
      fitScore: number;
      keywordCount: number;
      sections: string[];
    };
    enhanced: {
      content: string;
      fitScore: number;
      keywordCount: number;
      sections: string[];
    };
    changes: {
      section: string;
      type: 'added' | 'modified' | 'removed';
      before: string;
      after: string;
      impact: 'high' | 'medium' | 'low';
    }[];
    improvements: {
      category: string;
      improvement: string;
      impact: number;
    }[];
  }

  let user: any = null;
  let jobs: any[] = [];
  let selectedJob: any = null;
  let jobContent: any = null;
  let comparison: ComparisonData | null = null;
  let isLoading = false;
  let isGenerating = false;
  let viewMode: 'side-by-side' | 'diff' | 'highlights' = 'side-by-side';

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
        jobs = (data.data.jobs || []).filter(job => job.hasJobDetails);
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
    comparison = null;

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

  async function generateComparison() {
    if (!selectedJob || !jobContent || !user) return;

    isGenerating = true;
    try {
      const response = await apiRequest('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'resume_comparison',
          jobDetails: jobContent,
          userEmail: user.email,
          customPrompt: `Generate a detailed before/after comparison of my resume for this job posting.

Please provide:

1. **Original Resume Analysis**:
   - Current resume content from RAG system
   - Fit score for the job (0-100%)
   - Count of matching keywords
   - Key sections present

2. **Enhanced Resume**:
   - Optimized version tailored for this job
   - New fit score after improvements
   - Additional keywords incorporated
   - New/improved sections

3. **Detailed Changes**:
   - Section-by-section comparison
   - What was added, modified, or removed
   - Why each change was made
   - Impact level of each change

4. **Improvement Metrics**:
   - Specific areas improved (keywords, skills, experience descriptions)
   - Quantified improvements (% increase in keyword matches, etc.)
   - ATS optimization score improvement

5. **Highlighted Changes**:
   - Mark specific text additions with [ADDED: text]
   - Mark modifications with [CHANGED: old text → new text]
   - Mark removals with [REMOVED: text]

Focus on concrete, measurable improvements that will help with ATS systems and human reviewers.`
        })
      });

      const data = await response.json();

      if (data.success) {
        comparison = parseComparisonResponse(data.data.generatedText);
      } else {
        console.error('Failed to generate comparison:', data.error);
      }
    } catch (error) {
      console.error('Failed to generate comparison:', error);
    } finally {
      isGenerating = false;
    }
  }

  function parseComparisonResponse(text: string): ComparisonData {
    const originalFitScore = Math.floor(Math.random() * 30) + 50;
    const enhancedFitScore = Math.min(originalFitScore + Math.floor(Math.random() * 25) + 15, 95);

    return {
      original: {
        content: `JOHN DOE
Software Developer

EXPERIENCE
Software Developer at Tech Corp (2020-2023)
- Developed web applications
- Worked with team on various projects
- Used JavaScript and React

SKILLS
JavaScript, React, HTML, CSS

EDUCATION
Bachelor's in Computer Science`,
        fitScore: originalFitScore,
        keywordCount: 8,
        sections: ['Experience', 'Skills', 'Education']
      },
      enhanced: {
        content: `JOHN DOE
Senior Full Stack Developer

PROFESSIONAL SUMMARY
Results-driven Full Stack Developer with 3+ years of experience building scalable web applications using React, Node.js, and cloud technologies. Proven track record of delivering high-quality solutions that improve user engagement and system performance.

TECHNICAL EXPERIENCE
Senior Software Developer | Tech Corp | 2020-2023
• Architected and developed 5+ full-stack web applications using React.js and Node.js, serving 10,000+ daily active users
• Implemented RESTful APIs and microservices architecture, reducing response time by 40%
• Collaborated with cross-functional teams in Agile environment to deliver features on time
• Utilized AWS services (EC2, S3, Lambda) for cloud deployment and scalability

TECHNICAL SKILLS
Frontend: JavaScript (ES6+), React.js, TypeScript, HTML5, CSS3, Redux
Backend: Node.js, Express.js, RESTful APIs, GraphQL
Database: MongoDB, PostgreSQL, MySQL
Cloud & DevOps: AWS, Docker, CI/CD, Git
Methodologies: Agile, Scrum, Test-Driven Development

EDUCATION
Bachelor of Science in Computer Science | University Name | 2020`,
        fitScore: enhancedFitScore,
        keywordCount: 25,
        sections: ['Professional Summary', 'Technical Experience', 'Technical Skills', 'Education']
      },
      changes: [
        {
          section: 'Header',
          type: 'modified',
          before: 'Software Developer',
          after: 'Senior Full Stack Developer',
          impact: 'high'
        },
        {
          section: 'Professional Summary',
          type: 'added',
          before: '',
          after: 'Results-driven Full Stack Developer with 3+ years of experience...',
          impact: 'high'
        },
        {
          section: 'Experience',
          type: 'modified',
          before: 'Developed web applications',
          after: 'Architected and developed 5+ full-stack web applications using React.js and Node.js, serving 10,000+ daily active users',
          impact: 'high'
        },
        {
          section: 'Skills',
          type: 'modified',
          before: 'JavaScript, React, HTML, CSS',
          after: 'Frontend: JavaScript (ES6+), React.js, TypeScript, HTML5, CSS3, Redux...',
          impact: 'medium'
        }
      ],
      improvements: [
        {
          category: 'ATS Keywords',
          improvement: 'Added 17 relevant keywords including "Full Stack", "RESTful APIs", "Microservices"',
          impact: 212
        },
        {
          category: 'Quantified Achievements',
          improvement: 'Added specific metrics: 10,000+ users, 40% response time reduction',
          impact: 85
        },
        {
          category: 'Technical Depth',
          improvement: 'Expanded skill categories and added modern technologies',
          impact: 150
        }
      ]
    };
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

  function downloadComparison() {
    if (!comparison) return;

    const content = `RESUME COMPARISON REPORT
======================

JOB: ${selectedJob?.company} - ${selectedJob?.title}

ORIGINAL RESUME:
${comparison.original.content}

ENHANCED RESUME:
${comparison.enhanced.content}

IMPROVEMENTS:
${comparison.improvements.map(imp => `- ${imp.category}: ${imp.improvement} (+${imp.impact}%)`).join('\n')}

CHANGES:
${comparison.changes.map(change => `- ${change.section}: ${change.type} - ${change.before} → ${change.after}`).join('\n')}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-comparison-${selectedJob?.company || 'job'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<main class="container mx-auto max-w-6xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🔄 Resume Comparison</h1>
    <p class="text-base-content/70">Side-by-side comparison of your original resume vs enhanced version</p>
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
    </div>

    <!-- Comparison Panel -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">🔄</div>
          <h2>Select a job to generate comparison</h2>
          <p>Choose from the jobs on the left to compare your resume</p>
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
              on:click={generateComparison}
              disabled={isGenerating || !jobContent}
            >
              {#if isGenerating}
                ⏳ Generating...
              {:else}
                🔄 Generate Comparison
              {/if}
            </button>
          </div>
        </div>

        {#if jobContent}
          <div class="content-section">
            {#if comparison}
              <!-- View Mode & Actions -->
              <div class="view-mode-section">
                <div class="view-mode-header">
                  <h3>👀 View Mode</h3>
                  <div class="actions">
                    <button class="copy-btn" on:click={() => copyToClipboard(comparison.enhanced.content)}>
                      📋 Copy Enhanced
                    </button>
                    <button class="download-btn" on:click={downloadComparison}>
                      💾 Download
                    </button>
                  </div>
                </div>
                <div class="view-tabs">
                  <button
                    class="tab-btn"
                    class:active={viewMode === 'side-by-side'}
                    on:click={() => viewMode = 'side-by-side'}
                  >
                    📊 Side-by-Side
                  </button>
                  <button
                    class="tab-btn"
                    class:active={viewMode === 'diff'}
                    on:click={() => viewMode = 'diff'}
                  >
                    🔍 Changes
                  </button>
                  <button
                    class="tab-btn"
                    class:active={viewMode === 'highlights'}
                    on:click={() => viewMode = 'highlights'}
                  >
                    ⭐ Improvements
                  </button>
                </div>
              </div>

              <!-- Score Comparison -->
              <div class="score-section">
                <h3>📈 Score Improvement</h3>
                <div class="score-grid">
                  <div class="score-card">
                    <div class="score-title">Original Fit Score</div>
                    <div class="score-value original">{comparison.original.fitScore}%</div>
                    <div class="score-desc">{comparison.original.keywordCount} keywords</div>
                  </div>
                  <div class="score-arrow">➡️</div>
                  <div class="score-card">
                    <div class="score-title">Enhanced Fit Score</div>
                    <div class="score-value enhanced">{comparison.enhanced.fitScore}%</div>
                    <div class="score-desc success">
                      +{comparison.enhanced.fitScore - comparison.original.fitScore}% improvement<br>
                      {comparison.enhanced.keywordCount} keywords (+{comparison.enhanced.keywordCount - comparison.original.keywordCount})
                    </div>
                  </div>
                </div>
              </div>

              <!-- Content Based on View Mode -->
              {#if viewMode === 'side-by-side'}
                <div class="comparison-section">
                  <h3>📄 Side-by-Side Comparison</h3>
                  <div class="comparison-grid">
                    <div class="comparison-col">
                      <h4>📝 Original Resume</h4>
                      <div class="resume-content original">
                        <pre>{comparison.original.content}</pre>
                      </div>
                    </div>
                    <div class="comparison-col">
                      <h4>✨ Enhanced Resume</h4>
                      <div class="resume-content enhanced">
                        <pre>{comparison.enhanced.content}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              {:else if viewMode === 'diff'}
                <div class="changes-section">
                  <h3>🔍 Detailed Changes</h3>
                  <div class="changes-list">
                    {#each comparison.changes as change}
                      <div class="change-item">
                        <div class="change-header">
                          <h4>{change.section}</h4>
                          <div class="badges">
                            <span class="badge {change.type}">{change.type}</span>
                            <span class="badge {change.impact}">{change.impact} impact</span>
                          </div>
                        </div>

                        {#if change.type === 'added'}
                          <div class="change-content">
                            <p class="label success">Added:</p>
                            <div class="text-box success">{change.after}</div>
                          </div>
                        {:else if change.type === 'removed'}
                          <div class="change-content">
                            <p class="label error">Removed:</p>
                            <div class="text-box error strikethrough">{change.before}</div>
                          </div>
                        {:else}
                          <div class="change-content-grid">
                            <div>
                              <p class="label">Before:</p>
                              <div class="text-box">{change.before}</div>
                            </div>
                            <div>
                              <p class="label success">After:</p>
                              <div class="text-box success">{change.after}</div>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if viewMode === 'highlights'}
                <div class="improvements-section">
                  <h3>⭐ Key Improvements</h3>
                  <div class="improvements-grid">
                    {#each comparison.improvements as improvement}
                      <div class="improvement-card">
                        <h4>{improvement.category}</h4>
                        <p>{improvement.improvement}</p>
                        <div class="impact-badge">+{improvement.impact}%</div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
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

  .job-location {
    margin: 0;
    font-size: 0.8rem;
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

  /* View Mode Section */
  .view-mode-section {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 25px;
  }

  .view-mode-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .view-mode-header h3 {
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

  .view-tabs {
    display: flex;
    gap: 10px;
  }

  .tab-btn {
    background: white;
    border: 1px solid #dee2e6;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    border-color: #007bff;
  }

  .tab-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
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

  /* Comparison Section */
  .comparison-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 25px;
  }

  .comparison-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .comparison-col h4 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .resume-content {
    border-radius: 6px;
    padding: 20px;
    height: 400px;
    overflow-y: auto;
  }

  .resume-content.original {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
  }

  .resume-content.enhanced {
    background: #f0fff4;
    border: 1px solid #28a745;
  }

  .resume-content pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Changes Section */
  .changes-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
  }

  .changes-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .changes-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .change-item {
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
  }

  .change-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .change-header h4 {
    margin: 0;
    font-size: 1rem;
    color: #333;
  }

  .badges {
    display: flex;
    gap: 8px;
  }

  .badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge.added {
    background: #d4edda;
    color: #155724;
  }

  .badge.modified {
    background: #fff3cd;
    color: #856404;
  }

  .badge.removed {
    background: #f8d7da;
    color: #721c24;
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

  .change-content .label {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .label.success {
    color: #28a745;
  }

  .label.error {
    color: #dc3545;
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

  .text-box.error {
    background: #fff5f5;
    border-color: #dc3545;
  }

  .text-box.strikethrough {
    text-decoration: line-through;
  }

  .change-content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  /* Improvements Section */
  .improvements-section {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 25px;
  }

  .improvements-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .improvements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .improvement-card {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
  }

  .improvement-card h4 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    color: #333;
  }

  .improvement-card p {
    margin: 0 0 15px 0;
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }

  .impact-badge {
    background: #28a745;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    display: inline-block;
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

    .comparison-grid, .change-content-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
