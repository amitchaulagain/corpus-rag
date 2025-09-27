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
  let enhancementFocus = 'ats'; // 'ats', 'skills', 'experience', 'keywords'

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
      // Extract fit scores
      const originalScoreMatch = text.match(/original[^0-9]*(\d+)%?/i);
      const enhancedScoreMatch = text.match(/enhanced[^0-9]*(\d+)%?/i);
      
      const originalFitScore = originalScoreMatch ? parseInt(originalScoreMatch[1]) : 0;
      const enhancedFitScore = enhancedScoreMatch ? parseInt(enhancedScoreMatch[1]) : 0;

      // Extract improvements from the text
      const improvements: Enhancement[] = [];
      
      // Look for section improvements
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

      // Extract ATS keywords
      const atsKeywords = {
        added: [] as string[],
        optimized: [] as string[]
      };

      // Look for keywords
      const keywordMatches = text.matchAll(/(?:keyword|ats)[:\s]*([^\n]+)/gi);
      for (const match of keywordMatches) {
        const keywords = match[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
        atsKeywords.added.push(...keywords);
      }

      // Extract enhanced resume content
      let enhancedResume = '';
      const resumeMatch = text.match(/(?:enhanced resume|complete resume)[:\s]*\n([\s\S]+?)(?:\n\n|\n##|\n###|$)/i);
      if (resumeMatch) {
        enhancedResume = resumeMatch[1].trim();
      }

      // Extract summary
      let summary = '';
      const summaryMatch = text.match(/(?:summary|overview)[:\s]*\n([^\n]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }

      // If parsing failed to extract meaningful data, return the raw text as enhanced resume
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

  function getImpactColor(impact: string): string {
    switch (impact) {
      case 'high': return 'text-success';
      case 'medium': return 'text-warning';
      case 'low': return 'text-info';
      default: return 'text-base-content';
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

<main class="container mx-auto max-w-7xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">✨ Resume Enhancement</h1>
    <p class="text-base-content/70">ATS optimization and tailored resume improvements for specific job descriptions</p>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Jobs List Sidebar -->
    <div class="lg:col-span-1">
      <div class="card bg-base-100 shadow-xl mb-6">
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
            <div class="space-y-3 max-h-80 overflow-y-auto">
              {#each jobs as job}
                <div
                  class="p-3 border rounded-lg cursor-pointer transition-all hover:border-primary text-sm"
                  class:border-primary={selectedJob?.filename === job.filename}
                  class:bg-primary={selectedJob?.filename === job.filename}
                  class:bg-opacity-5={selectedJob?.filename === job.filename}
                  role="button"
                  tabindex="0"
                  on:click={() => selectJob(job)}
                  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectJob(job); } }}
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

      <!-- Enhancement Focus -->
      {#if selectedJob}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h3 class="card-title text-sm mb-3">🎯 Enhancement Focus</h3>
            <div class="space-y-2">
              {#each focusOptions as option}
                <label class="cursor-pointer">
                  <input 
                    type="radio" 
                    bind:group={enhancementFocus} 
                    value={option.value} 
                    class="radio radio-primary radio-sm"
                  />
                  <div class="ml-2">
                    <div class="text-sm font-medium">{option.label}</div>
                    <div class="text-xs text-base-content/60">{option.description}</div>
                  </div>
                </label>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Enhancement Panel -->
    <div class="lg:col-span-3">
      {#if !selectedJob}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body text-center py-16">
            <span class="text-6xl block mb-4">✨</span>
            <h2 class="text-2xl font-bold mb-2">Select a Job to Enhance Resume</h2>
            <p class="text-base-content/70">Choose a job from the list to start optimizing your resume</p>
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
          <!-- Job Header & Enhancement Button -->
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
                <div class="text-right">
                  <div class="mb-2">
                    <span class="text-sm text-base-content/70">Focus:</span>
                    <span class="badge badge-primary badge-sm ml-1">
                      {focusOptions.find(opt => opt.value === enhancementFocus)?.label}
                    </span>
                  </div>
                  <button
                    class="btn btn-primary"
                    on:click={enhanceResume}
                    disabled={isEnhancing}
                  >
                    {#if isEnhancing}
                      <span class="loading loading-spinner loading-sm"></span>
                      Enhancing...
                    {:else}
                      ✨ Enhance Resume
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Job Description -->
          {#if jobContent && jobContent.details}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">📄 Job Description</h3>
                <div class="prose prose-sm max-w-none">
                  <div class="whitespace-pre-wrap text-sm leading-relaxed max-h-64 overflow-y-auto">
                    {jobContent.details}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Enhancement Results -->
          {#if enhancement}
            <!-- Score Improvement -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">📈 Improvement Score</h3>
                <div class="grid grid-cols-3 gap-4">
                  <div class="text-center">
                    <div class="text-2xl font-bold text-base-content/70">{enhancement.originalFitScore}%</div>
                    <div class="text-sm text-base-content/70">Original Score</div>
                  </div>
                  <div class="text-center">
                    <div class="text-3xl">➡️</div>
                    <div class="text-sm text-base-content/70">Enhanced</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-success">{enhancement.enhancedFitScore}%</div>
                    <div class="text-sm text-base-content/70">
                      +{enhancement.enhancedFitScore - enhancement.originalFitScore}% improvement
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Specific Improvements -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">🔧 Specific Improvements</h3>
                <div class="space-y-4">
                  {#each enhancement.improvements as improvement}
                    <div class="border rounded-lg p-4">
                      <div class="flex justify-between items-center mb-3">
                        <h4 class="font-semibold">{improvement.section}</h4>
                        <div class="badge {getImpactBadge(improvement.impact)}">{improvement.impact} impact</div>
                      </div>
                      
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <p class="text-sm font-medium text-base-content/70 mb-2">Before:</p>
                          <div class="bg-base-200 p-3 rounded text-sm">
                            {improvement.original}
                          </div>
                        </div>
                        <div>
                          <p class="text-sm font-medium text-success mb-2">After:</p>
                          <div class="bg-success/10 border border-success/20 p-3 rounded text-sm">
                            {improvement.enhanced}
                          </div>
                        </div>
                      </div>
                      
                      <div class="text-sm text-base-content/70">
                        <strong>Why:</strong> {improvement.reason}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- ATS Keywords -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">🤖 ATS Keywords Enhancement</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 class="font-semibold text-success mb-2">✅ Keywords Added</h4>
                    <div class="flex flex-wrap gap-2">
                      {#each enhancement.atsKeywords.added as keyword}
                        <span class="badge badge-success badge-outline">{keyword}</span>
                      {/each}
                    </div>
                  </div>
                  <div>
                    <h4 class="font-semibold text-info mb-2">🔧 Keywords Optimized</h4>
                    <div class="flex flex-wrap gap-2">
                      {#each enhancement.atsKeywords.optimized as keyword}
                        <span class="badge badge-info badge-outline">{keyword}</span>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Enhanced Resume Preview -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="card-title">📄 Enhanced Resume</h3>
                  <div class="flex gap-2">
                    <button 
                      class="btn btn-outline btn-sm" 
                      on:click={() => copyToClipboard(enhancement?.enhancedResume || '')}
                    >
                      📋 Copy
                    </button>
                    <button 
                      class="btn btn-primary btn-sm" 
                      on:click={downloadEnhancedResume}
                    >
                      💾 Download
                    </button>
                  </div>
                </div>
                
                <div class="bg-base-200 p-4 rounded-lg max-h-96 overflow-y-auto">
                  <pre class="text-sm whitespace-pre-wrap font-sans">{enhancement.enhancedResume}</pre>
                </div>
              </div>
            </div>
          {:else if isEnhancing}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-16">
                <span class="loading loading-spinner loading-lg mb-4"></span>
                <h3 class="text-lg font-semibold mb-2">Enhancing Your Resume</h3>
                <p class="text-base-content/70">Optimizing for {focusOptions.find(opt => opt.value === enhancementFocus)?.label}...</p>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</main>
