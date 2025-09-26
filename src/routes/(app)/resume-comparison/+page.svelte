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
    // Mock data for demonstration - in a real app, you'd parse the actual response
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
          impact: 212 // percentage increase
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

  function getChangeTypeColor(type: string): string {
    switch (type) {
      case 'added': return 'text-success';
      case 'modified': return 'text-warning';
      case 'removed': return 'text-error';
      default: return 'text-base-content';
    }
  }

  function getChangeTypeBadge(type: string): string {
    switch (type) {
      case 'added': return 'badge-success';
      case 'modified': return 'badge-warning';
      case 'removed': return 'badge-error';
      default: return 'badge-ghost';
    }
  }

  function getImpactBadge(impact: string): string {
    switch (impact) {
      case 'high': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'low': return 'badge-info';
      default: return 'badge-ghost';
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

<main class="container mx-auto max-w-7xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🔄 Resume Comparison</h1>
    <p class="text-base-content/70">Side-by-side comparison of your original resume vs enhanced version with highlighted changes</p>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Jobs List Sidebar -->
    <div class="lg:col-span-1">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">💼 Jobs ({jobs.length})</h2>
            <button class="btn btn-ghost btn-sm" on:click={loadJobs} disabled={isLoading}>
              {#if isLoading}
                <span class="loading loading-spinner loading-sm"></span>
              {:else}
                🔄
              {/if}
            </button>
          </div>

          {#if isLoading}
            <div class="flex justify-center py-8">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          {:else if jobs.length === 0}
            <div class="text-center py-8">
              <span class="text-4xl block mb-2">📋</span>
              <p class="text-base-content/70 text-sm">No jobs found</p>
            </div>
          {:else}
            <div class="space-y-3 max-h-96 overflow-y-auto">
              {#each jobs as job}
                <div
                  class="p-3 border rounded-lg cursor-pointer transition-all hover:border-primary text-sm"
                  class:border-primary={selectedJob?.filename === job.filename}
                  class:bg-primary={selectedJob?.filename === job.filename}
                  class:bg-opacity-5={selectedJob?.filename === job.filename}
                  on:click={() => selectJob(job)}
                >
                  <div class="flex justify-between items-start mb-1">
                    <div class="badge badge-xs badge-primary">Job</div>
                    <span class="text-xs text-base-content/50">{formatFileSize(job.size)}</span>
                  </div>
                  <h3 class="font-semibold text-xs mb-1">{job.company}</h3>
                  <p class="text-xs text-base-content/70">{job.title}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Comparison Panel -->
    <div class="lg:col-span-3">
      {#if !selectedJob}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body text-center py-16">
            <span class="text-6xl block mb-4">🔄</span>
            <h2 class="text-2xl font-bold mb-2">Select a Job for Comparison</h2>
            <p class="text-base-content/70">Choose a job from the list to generate a before/after resume comparison</p>
          </div>
        </div>
      {:else if !jobContent}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body text-center py-16">
            <span class="loading loading-spinner loading-lg mb-4"></span>
            <p class="text-base-content/70">Loading job details...</p>
          </div>
        </div>
      {:else}
        <div class="space-y-6">
          <!-- Job Header & Generate Button -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="card-title text-xl mb-2">{selectedJob.company}</h2>
                  <h3 class="text-lg font-medium mb-2">{selectedJob.title}</h3>
                  {#if selectedJob.location}
                    <p class="text-base-content/70">📍 {selectedJob.location}</p>
                  {/if}
                </div>
                <button
                  class="btn btn-primary"
                  on:click={generateComparison}
                  disabled={isGenerating}
                >
                  {#if isGenerating}
                    <span class="loading loading-spinner loading-sm"></span>
                    Generating...
                  {:else}
                    🔄 Generate Comparison
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <!-- Comparison Results -->
          {#if comparison}
            <!-- View Mode Selector -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="flex justify-between items-center">
                  <h3 class="card-title">👀 View Mode</h3>
                  <div class="flex gap-2">
                    <button 
                      class="btn btn-outline btn-sm" 
                      on:click={() => copyToClipboard(comparison.enhanced.content)}
                    >
                      📋 Copy Enhanced
                    </button>
                    <button 
                      class="btn btn-primary btn-sm" 
                      on:click={downloadComparison}
                    >
                      💾 Download Report
                    </button>
                  </div>
                </div>
                <div class="tabs tabs-boxed mt-4">
                  <button 
                    class="tab" 
                    class:tab-active={viewMode === 'side-by-side'}
                    on:click={() => viewMode = 'side-by-side'}
                  >
                    📊 Side-by-Side
                  </button>
                  <button 
                    class="tab" 
                    class:tab-active={viewMode === 'diff'}
                    on:click={() => viewMode = 'diff'}
                  >
                    🔍 Changes
                  </button>
                  <button 
                    class="tab" 
                    class:tab-active={viewMode === 'highlights'}
                    on:click={() => viewMode = 'highlights'}
                  >
                    ⭐ Improvements
                  </button>
                </div>
              </div>
            </div>

            <!-- Score Comparison -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">📈 Score Improvement</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div class="text-center">
                    <div class="stat">
                      <div class="stat-title">Original Fit Score</div>
                      <div class="stat-value text-base-content/70">{comparison.original.fitScore}%</div>
                      <div class="stat-desc">{comparison.original.keywordCount} keywords</div>
                    </div>
                  </div>
                  <div class="text-center flex items-center justify-center">
                    <div class="text-3xl">➡️</div>
                  </div>
                  <div class="text-center">
                    <div class="stat">
                      <div class="stat-title">Enhanced Fit Score</div>
                      <div class="stat-value text-success">{comparison.enhanced.fitScore}%</div>
                      <div class="stat-desc text-success">
                        +{comparison.enhanced.fitScore - comparison.original.fitScore}% improvement
                        <br>
                        {comparison.enhanced.keywordCount} keywords (+{comparison.enhanced.keywordCount - comparison.original.keywordCount})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Content Based on View Mode -->
            {#if viewMode === 'side-by-side'}
              <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                  <h3 class="card-title mb-4">📄 Side-by-Side Comparison</h3>
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 class="font-semibold text-base-content/70 mb-3">📝 Original Resume</h4>
                      <div class="bg-base-200 p-4 rounded-lg h-96 overflow-y-auto">
                        <pre class="text-sm whitespace-pre-wrap font-sans">{comparison.original.content}</pre>
                      </div>
                    </div>
                    <div>
                      <h4 class="font-semibold text-success mb-3">✨ Enhanced Resume</h4>
                      <div class="bg-success/10 border border-success/20 p-4 rounded-lg h-96 overflow-y-auto">
                        <pre class="text-sm whitespace-pre-wrap font-sans">{comparison.enhanced.content}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {:else if viewMode === 'diff'}
              <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                  <h3 class="card-title mb-4">🔍 Detailed Changes</h3>
                  <div class="space-y-4">
                    {#each comparison.changes as change}
                      <div class="border rounded-lg p-4">
                        <div class="flex justify-between items-center mb-3">
                          <h4 class="font-semibold">{change.section}</h4>
                          <div class="flex gap-2">
                            <div class="badge {getChangeTypeBadge(change.type)}">{change.type}</div>
                            <div class="badge {getImpactBadge(change.impact)}">{change.impact} impact</div>
                          </div>
                        </div>
                        
                        {#if change.type === 'added'}
                          <div>
                            <p class="text-sm font-medium text-success mb-2">Added:</p>
                            <div class="bg-success/10 border border-success/20 p-3 rounded text-sm">
                              {change.after}
                            </div>
                          </div>
                        {:else if change.type === 'removed'}
                          <div>
                            <p class="text-sm font-medium text-error mb-2">Removed:</p>
                            <div class="bg-error/10 border border-error/20 p-3 rounded text-sm line-through">
                              {change.before}
                            </div>
                          </div>
                        {:else}
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p class="text-sm font-medium text-base-content/70 mb-2">Before:</p>
                              <div class="bg-base-200 p-3 rounded text-sm">
                                {change.before}
                              </div>
                            </div>
                            <div>
                              <p class="text-sm font-medium text-success mb-2">After:</p>
                              <div class="bg-success/10 border border-success/20 p-3 rounded text-sm">
                                {change.after}
                              </div>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {:else if viewMode === 'highlights'}
              <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                  <h3 class="card-title mb-4">⭐ Key Improvements</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each comparison.improvements as improvement}
                      <div class="card bg-base-200 shadow-sm">
                        <div class="card-body p-4">
                          <h4 class="font-semibold text-sm mb-2">{improvement.category}</h4>
                          <p class="text-sm text-base-content/70 mb-3">{improvement.improvement}</p>
                          <div class="flex justify-between items-center">
                            <span class="text-xs text-base-content/50">Impact:</span>
                            <div class="badge badge-success">+{improvement.impact}%</div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          {:else if isGenerating}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-16">
                <span class="loading loading-spinner loading-lg mb-4"></span>
                <h3 class="text-lg font-semibold mb-2">Generating Comparison</h3>
                <p class="text-base-content/70">Analyzing your resume and creating enhanced version...</p>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</main>
