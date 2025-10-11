<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';
  import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
  import jsPDF from 'jspdf';

  let user: any = null;
  let jobs: any[] = [];
  let selectedJob: any = null;
  let jobContent: any = null;
  let jobDescription: string = '';
  let isLoading: boolean = false;
  let isGenerating: boolean = false;
  let enhancedResume: string | null = null;
  let originalResume: string = '';
  let enhancementFocus: string = 'general';
  let analysisResult: any = null;
  let fitScore: number = 0;
  let enhancedFitScore: number = 0;
  let comparisonView: 'unified' | 'sidebyside' = 'sidebyside';
  let enhancementPrompt: string = '';
  let defaultPrompt: string = '';
  let lastSavedPrompt: string = '';
  let isPromptExpanded: boolean = false;
  let isPromptModified: boolean = false;
  let availableResumes: any[] = [];
  let selectedResumeFile: string = '';
  let isLoadingResume: boolean = false;

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
      loadAvailableResumes();
      loadPrompt();
    }
  });

  async function loadAvailableResumes() {
    if (!user) {
      console.error('❌ Cannot load resumes: user is null');
      return;
    }
    
    console.log('📄 Loading available resumes for:', user.email);
    isLoadingResume = true;
    
    try {
      const url = `/api/upload?userId=${encodeURIComponent(user.email)}`;
      console.log('Fetching from:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('✓ Available resumes response:', data);
      console.log('✓ Files found:', data.files?.length || 0);
      
      if (data.success && data.files && data.files.length > 0) {
        availableResumes = data.files;
        selectedResumeFile = data.files[0].name;
        
        console.log('✓ Available resumes:', availableResumes);
        console.log('✓ Auto-selected:', selectedResumeFile);
        
        await loadResumeFile(selectedResumeFile);
      } else {
        console.warn('⚠️ No resume files found');
        availableResumes = [];
      }
    } catch (error: any) {
      console.error('❌ Failed to load resume list:', error);
      availableResumes = [];
    } finally {
      isLoadingResume = false;
      console.log('✓ isLoadingResume set to false');
      console.log('✓ availableResumes.length:', availableResumes.length);
    }
  }

  async function loadResumeFile(filename: string) {
    if (!user || !filename) return;
    
    isLoadingResume = true;
    try {
      console.log('Loading resume file:', filename);
      
      const response = await fetch(`/api/upload?userId=${encodeURIComponent(user.email)}&filename=${encodeURIComponent(filename)}`);
      const data = await response.json();
      
      console.log('Resume content response:', data.success ? '✓ Success' : '✗ Failed', data.error || '');
      
      if (data.success && data.content) {
        originalResume = data.content;
        console.log('✅ Resume loaded:', filename, '-', data.content.length, 'characters');
      } else {
        console.error('Failed to load resume content:', data.error);
        alert('Failed to load resume: ' + (data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to load resume file:', error);
      alert('Failed to load resume file: ' + error.message);
    } finally {
      isLoadingResume = false;
    }
  }

  async function onResumeFileChange() {
    if (selectedResumeFile) {
      await loadResumeFile(selectedResumeFile);
    }
  }

  async function loadPrompt() {
    try {
      const response = await fetch('/api/prompts/resume-enhancement');
      const data = await response.json();
      enhancementPrompt = data.content || getDefaultPrompt();
      lastSavedPrompt = data.content || '';
      isPromptModified = data.isModified || false;

      const defaultResponse = await fetch('/api/prompts/resume-enhancement?default=true');
      const defaultData = await defaultResponse.json();
      defaultPrompt = defaultData.content || getDefaultPrompt();
    } catch (error) {
      console.error('Failed to load prompt:', error);
      enhancementPrompt = getDefaultPrompt();
      defaultPrompt = enhancementPrompt;
    }
  }

  function getDefaultPrompt() {
    return `You are an expert resume enhancement specialist. I will provide you with my current resume and a job description.

Your task: Enhance my resume to maximize fit for this specific job.

Instructions:
1. Calculate ORIGINAL FIT SCORE (0-100%) based on current resume match
2. Enhance the resume with focus on: ${enhancementFocus}
3. Calculate ENHANCED FIT SCORE (0-100%) after improvements
4. Provide the complete ENHANCED RESUME text

Enhancement Focus Areas:
- ATS Optimization: Keywords, formatting, ATS-friendly structure
- Skills Matching: Highlight relevant technical and soft skills
- Keyword Enhancement: Industry terminology and buzzwords
- Experience Boost: Quantify achievements, action verbs, impact
- General: Overall professional presentation

Format your response clearly showing:
- Original Fit Score: XX%
- Enhanced Fit Score: XX%
- [Then provide the complete enhanced resume text]`;
  }

  async function savePrompt(content: string) {
    if (content === lastSavedPrompt) return;

    try {
      const response = await fetch('/api/prompts/resume-enhancement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = content;
        isPromptModified = content !== defaultPrompt;
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  async function resetPrompt() {
    if (confirm('Reset prompt to default? This will overwrite your current prompt.')) {
      enhancementPrompt = defaultPrompt;
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
        jobs = (data.data.jobs || []).filter((job: any) => job.hasJobDetails);
      } else {
        alert('Failed to load jobs: ' + data.error);
      }
    } catch (error: any) {
      console.error('Failed to load jobs:', error);
      alert('Failed to load jobs: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  async function selectJob(job: any) {
    selectedJob = job;
    jobContent = null;
    jobDescription = '';
    
    try {
      const response = await fetch(`/api/jobs/${job.filename}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        jobContent = data.data;
        const content = data.data;
        let description = '';
        
        if (content.details) {
          description = content.details;
        } else if (content.description) {
          description = content.description;
        } else {
          description = JSON.stringify(content, null, 2);
        }
        
        jobDescription = description;
      }
    } catch (error: any) {
      console.error('Failed to load job details:', error);
      alert('Failed to load job details: ' + error.message);
    }
  }

  async function enhanceResume() {
    if (!jobDescription.trim()) {
      alert('Please select a job or enter a job description');
      return;
    }

    if (!originalResume.trim()) {
      alert('No resume found. Please upload your resume first.');
      return;
    }

    isGenerating = true;
    enhancedResume = null;
    analysisResult = null;
    
    try {
      await savePrompt(enhancementPrompt);

      console.log('=== ENHANCEMENT REQUEST ===');
      console.log('✓ Original resume:', originalResume.length, 'characters');
      console.log('✓ Job description:', jobDescription.length, 'characters');
      console.log('✓ Enhancement focus:', enhancementFocus);
      console.log('✓ Selected resume file:', selectedResumeFile);
      console.log('✓ User email:', user.email);
      console.log('========================');
      
      const requestPayload = {
        type: 'resume_enhancement',
        jobDetails: jobDescription,
        resumeText: originalResume,  // Your resume content
        userEmail: user.email,
        enhancementFocus: enhancementFocus,
        customPrompt: enhancementPrompt
      };
      
      console.log('Sending to API:', {
        ...requestPayload,
        resumeText: `${originalResume.length} chars`,
        customPrompt: `${enhancementPrompt.length} chars`
      });
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });
      
      console.log('API response status:', response.status);

      const data = await response.json();

      if (data.success) {
        const fullResponse = data.data.generatedText;
        
        const originalFitMatch = fullResponse.match(/original fit score[:\s]+(\d+)/i);
        const enhancedFitMatch = fullResponse.match(/enhanced fit score[:\s]+(\d+)/i);
        
        if (originalFitMatch) fitScore = parseInt(originalFitMatch[1]);
        if (enhancedFitMatch) enhancedFitScore = parseInt(enhancedFitMatch[1]);
        
        enhancedResume = fullResponse;
        await analyzeEnhancement();
      } else {
        alert('Failed to enhance resume: ' + data.error);
      }
    } catch (error: any) {
      console.error('Failed to enhance resume:', error);
      alert('Failed to enhance resume: ' + error.message);
    } finally {
      isGenerating = false;
    }
  }

  async function analyzeEnhancement() {
    if (!enhancedResume || !originalResume) return;
    
    try {
      const lines1 = originalResume.split('\n');
      const lines2 = enhancedResume.split('\n');
      
      analysisResult = {
        totalLines: lines2.length,
        linesAdded: 0,
        linesRemoved: 0,
        fitScoreImprovement: enhancedFitScore - fitScore
      };
      
      const originalLines = new Set(lines1);
      const enhancedLines = new Set(lines2);
      
      lines2.forEach(line => {
        if (!originalLines.has(line) && line.trim()) {
          analysisResult.linesAdded++;
        }
      });
      
      lines1.forEach(line => {
        if (!enhancedLines.has(line) && line.trim()) {
          analysisResult.linesRemoved++;
        }
      });
    } catch (error: any) {
      console.error('Failed to analyze:', error);
    }
  }

  function generateDiff() {
    if (!originalResume || !enhancedResume) return [];
    
    const lines1 = originalResume.split('\n');
    const lines2 = enhancedResume.split('\n');
    const diff: any[] = [];
    
    const maxLength = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalLine = lines1[i] || '';
      const enhancedLine = lines2[i] || '';
      
      if (originalLine === enhancedLine) {
        diff.push({ type: 'unchanged', original: originalLine, enhanced: enhancedLine });
      } else if (!originalLine) {
        diff.push({ type: 'added', original: '', enhanced: enhancedLine });
      } else if (!enhancedLine) {
        diff.push({ type: 'removed', original: originalLine, enhanced: '' });
      } else {
        diff.push({ type: 'modified', original: originalLine, enhanced: enhancedLine });
      }
    }
    
    return diff;
  }

  async function downloadAsDocx() {
    if (!enhancedResume) return;
    
    try {
      const lines = enhancedResume.split('\n').filter((line: string) => line.trim());
      
      const paragraphs = lines.map((line: string) => {
        const isHeading = line.length < 50 && (
          line === line.toUpperCase() ||
          /^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)/i.test(line)
        );
        
        if (isHeading) {
          return new Paragraph({
            text: line,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          });
        } else {
          return new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 120 }
          });
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enhanced_resume_${selectedJob?.company?.replace(/\s+/g, '_') || 'generic'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate DOCX:', error);
      alert('Failed to generate DOCX file. Please try again.');
    }
  }

  function downloadAsPdf() {
    if (!enhancedResume) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      
      let yPosition = margin;
      const lineHeight = 7;
      
      const lines = enhancedResume.split('\n');
      
      lines.forEach((line: string) => {
        if (!line.trim()) {
          yPosition += lineHeight / 2;
          return;
        }
        
        const isHeading = line.length < 50 && (
          line === line.toUpperCase() ||
          /^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)/i.test(line)
        );
        
        if (isHeading) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
        }
        
        const splitLines = doc.splitTextToSize(line, maxWidth);
        
        splitLines.forEach((splitLine: string) => {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.text(splitLine, margin, yPosition);
          yPosition += lineHeight;
        });
        
        if (isHeading) {
          yPosition += lineHeight / 2;
        }
      });
      
      doc.save(`enhanced_resume_${selectedJob?.company?.replace(/\s+/g, '_') || 'generic'}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF file. Please try again.');
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">✨ Resume Enhancement</h1>
    <p class="text-base-content/70">Tailor your resume to match specific job requirements using AI</p>

    <!-- AI Prompt Section -->
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
              bind:textContent={enhancementPrompt}
              on:blur={() => savePrompt(enhancementPrompt)}
            >{enhancementPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={enhancementPrompt}
              placeholder="Enter your AI prompt here..."
              rows="8"
              on:blur={() => savePrompt(enhancementPrompt)}
            ></textarea>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="main-content">
    <!-- Debug Info (Always Visible) -->
    <div class="debug-section">
      <strong>Debug Info:</strong>
      User: {user?.email || 'Not loaded'} | 
      Loading: {isLoadingResume ? 'Yes' : 'No'} | 
      Available Resumes: {availableResumes.length} | 
      Selected: {selectedResumeFile || 'None'} |
      Resume Loaded: {originalResume ? `Yes (${originalResume.length} chars)` : 'No'}
    </div>

    <!-- Resume File Selector -->
    <div class="resume-selector-section">
      <div class="section-header-with-action">
        <h3 class="section-title">📄 Select Your Resume</h3>
        <button class="refresh-btn" on:click={loadAvailableResumes} disabled={isLoadingResume}>
          {#if isLoadingResume}⏳{:else}🔄{/if} Refresh
        </button>
      </div>
      {#if isLoadingResume}
        <div class="loading-small">⏳ Loading resumes...</div>
      {:else if availableResumes.length === 0}
        <div class="status-card warning">
          ⚠️ <strong>No Resume Found:</strong> Please <a href="/upload">upload your resume</a> first (.txt or .pdf file)
        </div>
      {:else}
        <div class="resume-files-list">
          {#each availableResumes as resumeFile}
            <label class="resume-file-option" class:selected={selectedResumeFile === resumeFile.name}>
              <input 
                type="radio" 
                bind:group={selectedResumeFile} 
                value={resumeFile.name}
                on:change={onResumeFileChange}
              />
              <div class="resume-file-info">
                <span class="file-icon">{resumeFile.type === 'pdf' ? '📕' : '📄'}</span>
                <div class="file-details">
                  <span class="file-name">{resumeFile.name}</span>
                  <span class="file-type-badge">{resumeFile.type.toUpperCase()}</span>
                </div>
              </div>
            </label>
          {/each}
        </div>
        {#if originalResume}
          <div class="status-card success">
            ✅ <strong>Resume Loaded:</strong> {originalResume.split('\n').length} lines, {originalResume.length} characters from <em>{selectedResumeFile}</em>
          </div>
        {:else}
          <div class="status-card warning">
            ⏳ <strong>Loading resume content...</strong> Please wait
          </div>
        {/if}
      {/if}
    </div>

    <!-- Enhancement Focus Selection -->
    <div class="focus-section">
      <h3 class="section-title">🎯 Enhancement Focus</h3>
      <div class="focus-options">
        <label class="focus-option">
          <input type="radio" bind:group={enhancementFocus} value="general" />
          <span>General Enhancement</span>
        </label>
        <label class="focus-option">
          <input type="radio" bind:group={enhancementFocus} value="ats" />
          <span>ATS Optimization</span>
        </label>
        <label class="focus-option">
          <input type="radio" bind:group={enhancementFocus} value="skills" />
          <span>Skills Matching</span>
        </label>
        <label class="focus-option">
          <input type="radio" bind:group={enhancementFocus} value="keywords" />
          <span>Keyword Enhancement</span>
        </label>
        <label class="focus-option">
          <input type="radio" bind:group={enhancementFocus} value="experience" />
          <span>Experience Boost</span>
        </label>
      </div>
    </div>

    <!-- Jobs List - Horizontal -->
    <div class="jobs-sidebar">
      <div class="sidebar-header">
        <h2>💼 Available Jobs</h2>
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
              on:keydown={(e) => e.key === 'Enter' && selectJob(job)}
              role="button"
              tabindex="0"
            >
              <div class="job-header">
                <span class="job-type">💼</span>
                <div class="job-header-right">
                  <span class="job-size">{formatFileSize(job.size)}</span>
                </div>
              </div>
              <div>
                <h3 class="job-company">{job.company}</h3>
                <p class="job-title">{job.title}</p>
                {#if job.location}
                  <p class="job-location">📍 {job.location}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Main Panel -->
    <div class="cover-letter-panel">
      {#if !selectedJob}
        <div class="no-selection">
          <div class="placeholder-icon">✨</div>
          <h2>Select a job to enhance your resume</h2>
          <p>Choose from the job descriptions above to start tailoring your resume</p>
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
              on:click={enhanceResume}
              disabled={isGenerating || !jobContent || !originalResume}
              style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"
            >
              {#if isGenerating}
                ⏳ Enhancing...
              {:else}
                ✨ Enhance Resume
              {/if}
            </button>
          </div>
        </div>

        <!-- Job Description Preview -->
        {#if jobContent}
          <div class="content-section">
            <div class="job-details-card">
              <div class="job-meta">
                <span class="meta-item">📝 Job Description</span>
                <span class="meta-item">{jobDescription.length} characters</span>
              </div>
              <div class="job-description-content">
                <pre class="job-text">{jobDescription}</pre>
              </div>
            </div>
          </div>
        {/if}

        <!-- Analysis Results -->
        {#if analysisResult}
          <div class="analysis-stats">
            <h3 class="section-title">📊 Enhancement Analysis</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Original Fit Score</div>
                <div class="stat-value">{fitScore}%</div>
              </div>
              <div class="stat-card improvement">
                <div class="stat-label">Enhanced Fit Score</div>
                <div class="stat-value">{enhancedFitScore}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Improvement</div>
                <div class="stat-value success">+{analysisResult.fitScoreImprovement}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Lines Added</div>
                <div class="stat-value added">{analysisResult.linesAdded}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Lines Removed</div>
                <div class="stat-value removed">{analysisResult.linesRemoved}</div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Enhanced Resume Result -->
        {#if enhancedResume}
          <div class="result-container">
            <div class="result-header">
              <h3 class="section-title">📝 Enhanced Resume</h3>
              <div class="header-actions">
                <div class="view-toggle">
                  <button 
                    class="view-btn" 
                    class:active={comparisonView === 'sidebyside'}
                    on:click={() => comparisonView = 'sidebyside'}
                  >
                    📊 Side by Side
                  </button>
                  <button 
                    class="view-btn" 
                    class:active={comparisonView === 'unified'}
                    on:click={() => comparisonView = 'unified'}
                  >
                    📄 Unified
                  </button>
                </div>
                <div class="download-actions">
                  <button class="download-btn" on:click={downloadAsDocx}>
                    📄 DOCX
                  </button>
                  <button class="download-btn" on:click={downloadAsPdf}>
                    📕 PDF
                  </button>
                </div>
              </div>
            </div>

            {#if comparisonView === 'sidebyside'}
              <div class="comparison-view">
                <div class="comparison-grid">
                  <div class="comparison-column">
                    <h4>Original Resume</h4>
                  </div>
                  <div class="comparison-column">
                    <h4>Enhanced Resume</h4>
                  </div>
                </div>
                <div class="comparison-content">
                  {#each generateDiff() as diffLine, i}
                    <div class="diff-row {diffLine.type}">
                      <div class="diff-cell">
                        <span class="line-num">{i + 1}</span>
                        <pre class="line-text">{diffLine.original}</pre>
                      </div>
                      <div class="diff-cell">
                        <span class="line-num">{i + 1}</span>
                        <pre class="line-text">{diffLine.enhanced}</pre>
                      </div>
                    </div>
                  {/each}
                </div>
                <div class="diff-legend">
                  <span class="legend-item added">Added</span>
                  <span class="legend-item removed">Removed</span>
                  <span class="legend-item modified">Modified</span>
                  <span class="legend-item unchanged">Unchanged</span>
                </div>
              </div>
            {:else}
              <div class="generated-content">
                <pre class="cover-letter-text">{enhancedResume}</pre>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</main>
</AdminGuard>

<style>
  /* Debug Section */
  .debug-section {
    background: rgba(255, 255, 0, 0.2);
    border: 2px solid orange;
    border-radius: 8px;
    padding: 12px 18px;
    margin-bottom: 15px;
    font-size: 0.9rem;
    font-family: monospace;
    color: inherit;
  }

  /* Resume Selector Section */
  .resume-selector-section {
    background: rgba(128, 128, 128, 0.1);
    border: 2px solid mediumvioletred;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .resume-files-list {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    margin-bottom: 15px;
  }

  .section-header-with-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .resume-file-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background: rgba(255, 255, 255, 0.5);
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .resume-file-option:hover {
    border-color: purple;
    background: rgba(128, 0, 128, 0.1);
    transform: translateY(-2px);
  }

  .resume-file-option.selected {
    border-color: purple;
    background: rgba(128, 0, 128, 0.15);
    border-width: 3px;
  }

  .resume-file-option input[type="radio"]:checked ~ .resume-file-info {
    font-weight: 600;
  }

  .resume-file-option input[type="radio"]:checked {
    accent-color: purple;
  }

  .resume-file-option input[type="radio"] {
    cursor: pointer;
    width: 20px;
    height: 20px;
  }

  .resume-file-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-icon {
    font-size: 2rem;
  }

  .file-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-name {
    font-size: 0.95rem;
    color: inherit;
    font-weight: 500;
  }

  .file-type-badge {
    font-size: 0.75rem;
    background: rgba(128, 0, 128, 0.2);
    color: purple;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    width: fit-content;
  }

  .loading-small {
    padding: 15px;
    text-align: center;
    color: inherit;
    opacity: 0.7;
  }

  /* Status Cards */
  .status-card {
    padding: 12px 18px;
    border-radius: 8px;
    margin-top: 15px;
    border-left: 4px solid;
    font-size: 0.9rem;
  }

  .status-card.success {
    background: rgba(40, 167, 69, 0.1);
    border-left-color: #28a745;
    color: inherit;
  }

  .status-card.warning {
    background: rgba(255, 193, 7, 0.1);
    border-left-color: #ffc107;
    color: inherit;
  }

  .status-card a {
    color: purple;
    text-decoration: underline;
  }

  /* Enhancement Focus Section */
  .focus-section {
    background: rgba(128, 128, 128, 0.1);
    border: 2px solid mediumseagreen;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: inherit;
  }

  .focus-options {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
  }

  .focus-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 15px;
    background: rgba(128, 128, 128, 0.1);
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .focus-option:hover {
    border-color: purple;
    background: rgba(128, 0, 128, 0.1);
  }

  .focus-option input[type="radio"] {
    cursor: pointer;
  }

  .focus-option input[type="radio"]:checked + span {
    font-weight: 600;
    color: purple;
  }

  /* Generate Section */
  .generate-section {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .generate-btn {
    padding: 12px 30px;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid rgba(128, 128, 128, 0.3);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: purple;
    background: rgba(128, 0, 128, 0.1);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reset-btn-small {
    background: transparent;
    border: 1px solid rgba(128, 128, 128, 0.4);
    color: inherit;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .reset-btn-small:hover {
    border-color: orange;
    background: rgba(255, 165, 0, 0.1);
  }

  /* Content Section */
  .content-section {
    padding: 25px;
  }

  /* Analysis Stats */
  .analysis-stats {
    background: rgba(128, 128, 128, 0.1);
    border: 2px solid dodgerblue;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 20px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.5);
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    border: 1px solid rgba(128, 128, 128, 0.2);
  }

  .stat-card.improvement {
    background: rgba(40, 167, 69, 0.1);
    border-color: #28a745;
  }

  .stat-label {
    font-size: 0.85rem;
    color: inherit;
    opacity: 0.8;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: purple;
  }

  .stat-value.success {
    color: #28a745;
  }

  .stat-value.added {
    color: #28a745;
  }

  .stat-value.removed {
    color: #dc3545;
  }

  /* Result Container */
  .result-container {
    background: transparent;
    border: 2px solid purple;
    border-radius: 8px;
    overflow: hidden;
  }

  .result-header {
    background: rgba(128, 128, 128, 0.1);
    padding: 20px 25px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
  }

  .header-actions {
    display: flex;
    gap: 15px;
    align-items: center;
    flex-wrap: wrap;
  }

  .view-toggle {
    display: flex;
    gap: 5px;
    background: rgba(128, 128, 128, 0.1);
    padding: 4px;
    border-radius: 6px;
  }

  .view-btn {
    background: transparent;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
    color: inherit;
  }

  .view-btn.active {
    background: purple;
    color: white;
  }

  .view-btn:hover:not(.active) {
    background: rgba(128, 0, 128, 0.2);
  }

  .download-actions {
    display: flex;
    gap: 8px;
  }

  .download-btn {
    background: mediumseagreen;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .download-btn:hover {
    background: seagreen;
    transform: translateY(-2px);
  }

  /* Comparison View */
  .comparison-view {
    background: transparent;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: rgba(128, 128, 128, 0.1);
    border-bottom: 2px solid rgba(128, 128, 128, 0.3);
  }

  .comparison-column {
    padding: 15px 20px;
    text-align: center;
  }

  .comparison-column:first-child {
    border-right: 1px solid rgba(128, 128, 128, 0.3);
  }

  .comparison-column h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: inherit;
  }

  .comparison-content {
    max-height: 600px;
    overflow-y: auto;
  }

  .diff-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  }

  .diff-row.added {
    background: rgba(40, 167, 69, 0.15);
  }

  .diff-row.removed {
    background: rgba(220, 53, 69, 0.15);
  }

  .diff-row.modified {
    background: rgba(255, 193, 7, 0.15);
  }

  .diff-row.unchanged {
    background: transparent;
  }

  .diff-cell {
    padding: 8px 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .diff-cell:first-child {
    border-right: 1px solid rgba(128, 128, 128, 0.2);
  }

  .line-num {
    min-width: 40px;
    text-align: right;
    color: inherit;
    opacity: 0.5;
    font-size: 0.8rem;
    font-family: monospace;
    user-select: none;
    flex-shrink: 0;
  }

  .line-text {
    margin: 0;
    flex: 1;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    color: inherit;
  }

  .diff-legend {
    display: flex;
    gap: 15px;
    padding: 15px 20px;
    background: rgba(128, 128, 128, 0.1);
    border-top: 1px solid rgba(128, 128, 128, 0.3);
    justify-content: center;
    flex-wrap: wrap;
  }

  .legend-item {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid rgba(128, 128, 128, 0.3);
  }

  .legend-item.added {
    background: rgba(40, 167, 69, 0.15);
    border-color: #28a745;
    color: inherit;
  }

  .legend-item.removed {
    background: rgba(220, 53, 69, 0.15);
    border-color: #dc3545;
    color: inherit;
  }

  .legend-item.modified {
    background: rgba(255, 193, 7, 0.15);
    border-color: #ffc107;
    color: inherit;
  }

  .legend-item.unchanged {
    background: transparent;
    border-color: rgba(128, 128, 128, 0.3);
    color: inherit;
  }

  /* Placeholder */
  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 20px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .comparison-grid,
    .diff-row {
      grid-template-columns: 1fr;
    }

    .diff-cell:first-child {
      border-right: none;
      border-bottom: 1px solid rgba(128, 128, 128, 0.2);
    }

    .header-actions {
      width: 100%;
      flex-direction: column;
    }

    .view-toggle,
    .download-actions {
      width: 100%;
    }

    .view-btn,
    .download-btn {
      flex: 1;
    }
  }
</style>
