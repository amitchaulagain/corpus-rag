<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  interface SkillCategory {
    name: string;
    skills: string[];
    matchedSkills: string[];
    score: number;
  }

  interface JobAnalysis {
    jobTitle: string;
    company: string;
    location: string;
    overallFitScore: number;
    categories: SkillCategory[];
    requiredSkills: string[];
    preferredSkills: string[];
    educationRequirements: string[];
    experienceRequirements: string[];
    keywords: string[];
    missingSkills: string[];
    recommendations: string[];
  }

  let user: any = null;
  let jobs: any[] = [];
  let selectedJob: any = null;
  let jobContent: any = null;
  let analysis: JobAnalysis | null = null;
  let isLoading = false;
  let isAnalyzing = false;

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
    analysis = null;

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

  async function analyzeJob() {
    if (!selectedJob || !jobContent || !user) return;

    isAnalyzing = true;
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
          customPrompt: `Analyze this job description and my resume to provide a detailed fit analysis. 

Please provide a comprehensive analysis including:

1. Overall fit score (0-100%)
2. Skill categories breakdown:
   - Technical Skills (programming languages, frameworks, tools)
   - Soft Skills (communication, leadership, teamwork)
   - Domain Knowledge (industry-specific expertise)
   - Certifications & Education
   - Experience Level

For each category, list:
- Required skills from the job
- Skills I have that match
- Skills I'm missing
- Category-specific fit score

3. Key insights:
   - Top 3 strongest matches
   - Top 3 areas for improvement
   - Specific recommendations to improve fit

4. ATS keyword analysis:
   - Important keywords from the job description
   - Keywords present in my resume
   - Missing keywords that should be added

Format the response as a detailed analysis with specific scores and actionable recommendations.`
        })
      });

      const data = await response.json();

      if (data.success) {
        // Parse the generated analysis into structured data
        analysis = parseAnalysisResponse(data.data.generatedText);
      } else {
        console.error('Failed to analyze job:', data.error);
      }
    } catch (error) {
      console.error('Failed to analyze job:', error);
    } finally {
      isAnalyzing = false;
    }
  }

  function parseAnalysisResponse(text: string): JobAnalysis {
    // This is a simplified parser - in a real application, you might want to use a more sophisticated approach
    const lines = text.split('\n');
    
    // Extract overall score
    const scoreMatch = text.match(/(?:overall|total|fit)\s*score[:\s]*(\d+)%?/i);
    const overallFitScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    // Mock structured data based on the analysis
    return {
      jobTitle: selectedJob?.title || 'Unknown Position',
      company: selectedJob?.company || 'Unknown Company',
      location: selectedJob?.location || 'Unknown Location',
      overallFitScore,
      categories: [
        {
          name: 'Technical Skills',
          skills: extractSkillsFromText(text, 'technical|programming|software|development'),
          matchedSkills: [],
          score: Math.floor(Math.random() * 40) + 60 // Mock score
        },
        {
          name: 'Soft Skills',
          skills: extractSkillsFromText(text, 'communication|leadership|teamwork|collaboration'),
          matchedSkills: [],
          score: Math.floor(Math.random() * 30) + 70 // Mock score
        },
        {
          name: 'Domain Knowledge',
          skills: extractSkillsFromText(text, 'domain|industry|business|experience'),
          matchedSkills: [],
          score: Math.floor(Math.random() * 50) + 50 // Mock score
        },
        {
          name: 'Education & Certifications',
          skills: extractSkillsFromText(text, 'degree|certification|education|qualification'),
          matchedSkills: [],
          score: Math.floor(Math.random() * 40) + 60 // Mock score
        }
      ],
      requiredSkills: extractListFromText(text, 'required|must have|essential'),
      preferredSkills: extractListFromText(text, 'preferred|nice to have|bonus'),
      educationRequirements: extractListFromText(text, 'education|degree|qualification'),
      experienceRequirements: extractListFromText(text, 'experience|years|background'),
      keywords: extractListFromText(text, 'keyword|important|key'),
      missingSkills: extractListFromText(text, 'missing|lack|need|improve'),
      recommendations: extractListFromText(text, 'recommend|suggest|should|advice')
    };
  }

  function extractSkillsFromText(text: string, pattern: string): string[] {
    const regex = new RegExp(`(${pattern})[^.]*`, 'gi');
    const matches = text.match(regex) || [];
    return matches.slice(0, 5); // Return first 5 matches
  }

  function extractListFromText(text: string, pattern: string): string[] {
    const lines = text.split('\n');
    const relevantLines = lines.filter(line => 
      new RegExp(pattern, 'i').test(line) && line.trim().length > 0
    );
    return relevantLines.slice(0, 5); // Return first 5 matches
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-error';
  }

  function getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'badge-success';
    if (score >= 60) return 'badge-warning';
    return 'badge-error';
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🎯 Job Description Analysis</h1>
    <p class="text-base-content/70">Extract required skills, calculate resume fit scores, and get detailed analysis by categories</p>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Jobs List Sidebar -->
    <div class="lg:col-span-1">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">💼 Available Jobs ({jobs.length})</h2>
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
              <p class="text-base-content/70">No job descriptions found</p>
            </div>
          {:else}
            <div class="space-y-3 max-h-96 overflow-y-auto">
              {#each jobs as job}
                <div
                  class="p-4 border rounded-lg cursor-pointer transition-all hover:border-primary"
                  class:border-primary={selectedJob?.filename === job.filename}
                  class:bg-primary={selectedJob?.filename === job.filename}
                  class:bg-opacity-5={selectedJob?.filename === job.filename}
                  on:click={() => selectJob(job)}
                >
                  <div class="flex justify-between items-start mb-2">
                    <div class="badge badge-sm badge-primary">
                      {#if job.hasQuestions}
                        💼❓ Job + Q&A
                      {:else}
                        💼 Job Only
                      {/if}
                    </div>
                    <span class="text-xs text-base-content/50">{formatFileSize(job.size)}</span>
                  </div>
                  <h3 class="font-semibold text-sm mb-1">{job.company}</h3>
                  <p class="text-sm text-base-content/70 mb-1">{job.title}</p>
                  {#if job.location}
                    <p class="text-xs text-base-content/50">📍 {job.location}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Analysis Panel -->
    <div class="lg:col-span-2">
      {#if !selectedJob}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body text-center py-16">
            <span class="text-6xl block mb-4">🎯</span>
            <h2 class="text-2xl font-bold mb-2">Select a Job to Analyze</h2>
            <p class="text-base-content/70">Choose a job from the list to start analyzing the fit with your resume</p>
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
          <!-- Job Header -->
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
                  on:click={analyzeJob}
                  disabled={isAnalyzing}
                >
                  {#if isAnalyzing}
                    <span class="loading loading-spinner loading-sm"></span>
                    Analyzing...
                  {:else}
                    🎯 Analyze Fit
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <!-- Analysis Results -->
          {#if analysis}
            <!-- Overall Score -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">📊 Overall Fit Analysis</h3>
                <div class="flex items-center gap-4">
                  <div class="radial-progress {getScoreColor(analysis.overallFitScore)}" style="--value:{analysis.overallFitScore};">
                    <span class="text-2xl font-bold">{analysis.overallFitScore}%</span>
                  </div>
                  <div>
                    <p class="text-lg font-semibold">Resume Fit Score</p>
                    <p class="text-base-content/70">
                      {#if analysis.overallFitScore >= 80}
                        Excellent match! You're highly qualified for this position.
                      {:else if analysis.overallFitScore >= 60}
                        Good match with some areas for improvement.
                      {:else}
                        Moderate match. Consider enhancing your qualifications.
                      {/if}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Category Breakdown -->
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title mb-4">📋 Skills & Qualifications Breakdown</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#each analysis.categories as category}
                    <div class="p-4 border rounded-lg">
                      <div class="flex justify-between items-center mb-3">
                        <h4 class="font-semibold">{category.name}</h4>
                        <div class="badge {getScoreBadgeClass(category.score)}">{category.score}%</div>
                      </div>
                      <div class="space-y-2">
                        {#if category.skills.length > 0}
                          <div>
                            <p class="text-sm font-medium text-base-content/70">Required Skills:</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                              {#each category.skills.slice(0, 3) as skill}
                                <span class="badge badge-outline badge-xs">{skill}</span>
                              {/each}
                            </div>
                          </div>
                        {/if}
                        <div class="progress progress-primary w-full">
                          <div class="progress-bar" style="width: {category.score}%"></div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Key Insights -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Missing Skills -->
              {#if analysis.missingSkills.length > 0}
                <div class="card bg-base-100 shadow-xl">
                  <div class="card-body">
                    <h3 class="card-title text-error mb-4">⚠️ Areas for Improvement</h3>
                    <div class="space-y-2">
                      {#each analysis.missingSkills.slice(0, 5) as skill}
                        <div class="flex items-center gap-2">
                          <span class="w-2 h-2 bg-error rounded-full"></span>
                          <span class="text-sm">{skill}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Recommendations -->
              {#if analysis.recommendations.length > 0}
                <div class="card bg-base-100 shadow-xl">
                  <div class="card-body">
                    <h3 class="card-title text-info mb-4">💡 Recommendations</h3>
                    <div class="space-y-2">
                      {#each analysis.recommendations.slice(0, 5) as recommendation}
                        <div class="flex items-start gap-2">
                          <span class="w-2 h-2 bg-info rounded-full mt-2 flex-shrink-0"></span>
                          <span class="text-sm">{recommendation}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Keywords Analysis -->
            {#if analysis.keywords.length > 0}
              <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                  <h3 class="card-title mb-4">🔑 ATS Keywords Analysis</h3>
                  <div>
                    <p class="text-sm font-medium text-base-content/70 mb-2">Important Keywords from Job Description:</p>
                    <div class="flex flex-wrap gap-2">
                      {#each analysis.keywords.slice(0, 10) as keyword}
                        <span class="badge badge-primary badge-outline">{keyword}</span>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {:else if isAnalyzing}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body text-center py-16">
                <span class="loading loading-spinner loading-lg mb-4"></span>
                <h3 class="text-lg font-semibold mb-2">Analyzing Job Requirements</h3>
                <p class="text-base-content/70">Comparing job requirements with your resume...</p>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</main>

<style>
  .progress {
    height: 8px;
    background-color: hsl(var(--b2));
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background-color: hsl(var(--p));
    transition: width 0.3s ease;
  }
</style>
