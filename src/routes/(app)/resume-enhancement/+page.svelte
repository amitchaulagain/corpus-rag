<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';
  import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
  import jsPDF from 'jspdf';
  import { resumeEnhancementStore } from '$lib/resume-enhancement-store';

  let user: any = null;
  let jobs: any[] = [];
  let selectedJob: any = null;
  let jobContent: any = null;
  let jobDescription: string = '';
  let isLoading: boolean = false;
  let originalResume: string = '';
  let enhancementFocus: string = 'general';
  let comparisonView: 'unified' | 'sidebyside' = 'sidebyside';
  let enhancementPrompt: string = '';
  let defaultPrompt: string = '';
  let lastSavedPrompt: string = '';
  let isPromptExpanded: boolean = false;
  let isPromptModified: boolean = false;
  let availableResumes: any[] = [];
  let selectedResumeFile: string = '';
  let isLoadingResume: boolean = false;
  let isEditingJob: boolean = false;
  let editedJobDescription: string = '';
  let editedJobData: any = null;
  let showJobForm: boolean = false;
  let newJob = { company: '', title: '', location: '', description: '' };
  let isSavingPrompt: boolean = false;

  // Use store for state management
  $: enhancedResume = $resumeEnhancementStore.enhancedResume;
  $: analysisResult = $resumeEnhancementStore.analysisResult;
  $: fitScore = $resumeEnhancementStore.fitScore;
  $: enhancedFitScore = $resumeEnhancementStore.enhancedFitScore;
  $: isGenerating = $resumeEnhancementStore.isGenerating;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      loadJobs();
      loadAvailableResumes();
      loadPrompt();

      // Restore selected job if available
      if ($resumeEnhancementStore.selectedJobFilename) {
        const jobToRestore = jobs.find(j => j.filename === $resumeEnhancementStore.selectedJobFilename);
        if (jobToRestore) {
          await selectJob(jobToRestore);
        }
      }
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

  function onPromptChange() {
    isPromptModified = enhancementPrompt !== lastSavedPrompt;
  }

  async function savePromptToFile() {
    if (enhancementPrompt === lastSavedPrompt) {
      alert('No changes to save');
      return;
    }

    isSavingPrompt = true;
    try {
      const response = await fetch('/api/prompts/resume-enhancement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: enhancementPrompt })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true) {
        lastSavedPrompt = enhancementPrompt;
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
      enhancementPrompt = defaultPrompt;
      await savePromptToFile();
    }
  }

  function toggleJobForm() {
    showJobForm = !showJobForm;
    if (showJobForm) {
      newJob = { company: '', title: '', location: '', description: '' };
    }
  }

  async function saveNewJob() {
    if (!newJob.company || !newJob.title || !newJob.description) {
      alert('Please fill in company, title, and description');
      return;
    }

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob)
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Job saved successfully');
        showJobForm = false;
        newJob = { company: '', title: '', location: '', description: '' };
        await loadJobs();
      } else {
        alert('❌ Failed to save job: ' + data.error);
      }
    } catch (error: any) {
      console.error('Failed to save job:', error);
      alert('❌ Failed to save job: ' + error.message);
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
    isEditingJob = false;

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
        editedJobDescription = description;
      }
    } catch (error: any) {
      console.error('Failed to load job details:', error);
      alert('Failed to load job details: ' + error.message);
    }
  }

  function startEditingJob() {
    isEditingJob = true;
    editedJobDescription = jobDescription;
    // Create a deep copy of jobContent for editing
    if (jobContent) {
      editedJobData = JSON.parse(JSON.stringify(jobContent));
    }
  }

  function cancelEditingJob() {
    isEditingJob = false;
    editedJobDescription = jobDescription;
    editedJobData = null;
  }

  function saveEditedJob() {
    if (editedJobData) {
      // Update jobContent with edited data
      jobContent = JSON.parse(JSON.stringify(editedJobData));
      // Update jobDescription from the edited data
      if (editedJobData.details) {
        jobDescription = editedJobData.details;
      } else if (editedJobData.description) {
        jobDescription = editedJobData.description;
      } else {
        jobDescription = JSON.stringify(editedJobData, null, 2);
      }
    }
    isEditingJob = false;
    editedJobData = null;
    alert('✅ Job description updated for this session');
  }
  
  // Helper function to check if a value is a nested object
  function isNestedObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  
  // Helper function to get display label for field names
  function getFieldLabel(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Helper function to check if a field should be readonly
  function isReadonlyField(key: string): boolean {
    const readonlyFields = [
      'jobId', 'jobid', 'job_id',
      'createdAt', 'createdat', 'created_at',
      'lastModified', 'lastmodified', 'last_modified', 'updatedAt', 'updatedat', 'updated_at',
      'size',
      'scrapedAt', 'scrapedat', 'scraped_at'
    ];
    return readonlyFields.includes(key.toLowerCase()) || key.toLowerCase().startsWith('custom_');
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

    // Start enhancement with store
    resumeEnhancementStore.startEnhancement(selectedJob.filename);

    try {
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

      // Get abort signal from store
      const abortSignal = resumeEnhancementStore.getAbortSignal();

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: abortSignal
      });

      console.log('API response status:', response.status);

      const data = await response.json();

      if (data.success) {
        const fullResponse = data.data.generatedText;

        const originalFitMatch = fullResponse.match(/original fit score[:\s]+(\d+)/i);
        const enhancedFitMatch = fullResponse.match(/enhanced fit score[:\s]+(\d+)/i);

        const origFit = originalFitMatch ? parseInt(originalFitMatch[1]) : 0;
        const enhFit = enhancedFitMatch ? parseInt(enhancedFitMatch[1]) : 0;

        // Calculate analysis
        const analysis = await calculateAnalysis(fullResponse, origFit, enhFit);

        // Set result in store
        resumeEnhancementStore.setEnhancementResult(fullResponse, analysis, origFit, enhFit);
      } else {
        resumeEnhancementStore.cancelEnhancement();
        alert('Failed to enhance resume: ' + data.error);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Enhancement cancelled by user');
      } else {
        console.error('Failed to enhance resume:', error);
        alert('Failed to enhance resume: ' + error.message);
      }
      resumeEnhancementStore.cancelEnhancement();
    }
  }

  async function calculateAnalysis(enhanced: string, origFit: number, enhFit: number) {
    if (!enhanced || !originalResume) return null;

    try {
      const lines1 = originalResume.split('\n');
      const lines2 = enhanced.split('\n');

      const analysis = {
        totalLines: lines2.length,
        linesAdded: 0,
        linesRemoved: 0,
        fitScoreImprovement: enhFit - origFit
      };

      const originalLines = new Set(lines1);
      const enhancedLines = new Set(lines2);

      lines2.forEach(line => {
        if (!originalLines.has(line) && line.trim()) {
          analysis.linesAdded++;
        }
      });

      lines1.forEach(line => {
        if (!enhancedLines.has(line) && line.trim()) {
          analysis.linesRemoved++;
        }
      });

      return analysis;
    } catch (error: any) {
      console.error('Failed to calculate analysis:', error);
      return null;
    }
  }

  function cancelEnhancement() {
    resumeEnhancementStore.cancelEnhancement();
  }

  function clearResults() {
    if (confirm('Clear all enhancement results? This will reset the page.')) {
      resumeEnhancementStore.clearResults();
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
              bind:textContent={enhancementPrompt}
              on:input={onPromptChange}
            >{enhancementPrompt}</pre>
          {:else}
            <textarea
              class="prompt-editor"
              bind:value={enhancementPrompt}
              placeholder="Enter your AI prompt here..."
              rows="8"
              on:input={onPromptChange}
            ></textarea>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="main-content">
    <!-- Resume Selection -->
    <div class="resume-selector-section">
      {#if isLoadingResume}
        <div class="resume-loading">
          <div class="spinner"></div>
          <span>Loading resumes...</span>
        </div>
      {:else if availableResumes.length === 0}
        <div class="resume-empty">
          <span class="empty-icon">📄</span>
          <p>No resumes found. <a href="/upload">Upload your resume</a> to get started.</p>
        </div>
      {:else}
        <div class="resume-selector">
          <label for="resume-select" class="selector-label">
            <span class="label-icon">📄</span>
            <span class="label-text">Select Resume</span>
          </label>
          <div class="selector-wrapper">
            <select
              id="resume-select"
              class="resume-dropdown"
              bind:value={selectedResumeFile}
              on:change={onResumeFileChange}
            >
              {#each availableResumes as file}
                <option value={file.name}>
                  {file.name} ({file.type.toUpperCase()})
                </option>
              {/each}
            </select>
            <button class="refresh-icon-btn" on:click={loadAvailableResumes} disabled={isLoadingResume} title="Refresh files">
              🔄
            </button>
          </div>
          {#if originalResume}
            <div class="resume-loaded-indicator">
              <span class="indicator-icon">✓</span>
              <span class="indicator-text">
                {originalResume.split('\n').length} lines · {originalResume.length} characters
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Jobs List - Horizontal -->
    <div class="jobs-sidebar">
      <div class="sidebar-header">
        <h2>💼 Available Jobs</h2>
        <div class="header-buttons">
          <button class="add-job-btn" on:click={toggleJobForm}>
            {#if showJobForm}✖️ Cancel{:else}➕ New Job{/if}
          </button>
          <button class="refresh-btn" on:click={loadJobs} disabled={isLoading}>
            {#if isLoading}⏳{:else}🔄{/if}
          </button>
        </div>
      </div>

      <!-- New Job Form -->
      {#if showJobForm}
        <div class="job-form">
          <h3 class="form-title">Add New Job</h3>
          <div class="form-group">
            <label for="company">Company Name *</label>
            <input type="text" id="company" bind:value={newJob.company} placeholder="e.g., Google" />
          </div>
          <div class="form-group">
            <label for="title">Job Title *</label>
            <input type="text" id="title" bind:value={newJob.title} placeholder="e.g., Senior Software Engineer" />
          </div>
          <div class="form-group">
            <label for="location">Location</label>
            <input type="text" id="location" bind:value={newJob.location} placeholder="e.g., Remote, USA" />
          </div>
          <div class="form-group">
            <label for="description">Job Description *</label>
            <textarea
              id="description"
              bind:value={newJob.description}
              placeholder="Paste the full job description here..."
              rows="10"
            ></textarea>
          </div>
          <button class="save-job-btn" on:click={saveNewJob}>
            💾 Save Job
          </button>
        </div>
      {/if}

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
            {#if isGenerating}
              <button class="cancel-btn" on:click={cancelEnhancement}>
                ✖ Cancel
              </button>
            {/if}
            {#if enhancedResume}
              <button class="clear-btn" on:click={clearResults}>
                🗑️ Clear Results
              </button>
            {/if}
          </div>
        </div>

        <!-- Job Description Preview -->
        {#if jobContent}
          <div class="content-section">
            <div class="job-details-card">
              <div class="job-meta">
                <span class="meta-item">📝 Job Description</span>
                <span class="meta-item">{jobDescription.length} characters</span>
                {#if !isEditingJob}
                  <button class="edit-btn" on:click={startEditingJob}>
                    ✏️ Edit
                  </button>
                {:else}
                  <div class="edit-actions">
                    <button class="save-btn" on:click={saveEditedJob}>
                      ✅ Save
                    </button>
                    <button class="cancel-btn" on:click={cancelEditingJob}>
                      ❌ Cancel
                    </button>
                  </div>
                {/if}
              </div>
              <div class="job-description-content">
                {#if isEditingJob && editedJobData}
                  <div class="dynamic-form">
                    {#each Object.keys(editedJobData) as key}
                      {#if !isNestedObject(editedJobData[key])}
                        <div class="form-field">
                          <label for="job-{key}">
                            {getFieldLabel(key)}
                            {#if key === 'details' || key === 'description'}
                              <span class="field-badge">Main Content</span>
                            {:else if isReadonlyField(key)}
                              <span class="field-badge readonly">Readonly</span>
                            {/if}
                          </label>
                          {#if key === 'details' || key === 'description'}
                            <textarea
                              id="job-{key}"
                              bind:value={editedJobData[key]}
                              rows="12"
                              class="form-textarea large"
                            ></textarea>
                          {:else if typeof editedJobData[key] === 'boolean'}
                            <label class="checkbox-label">
                              <input
                                type="checkbox"
                                id="job-{key}"
                                bind:checked={editedJobData[key]}
                                disabled={isReadonlyField(key)}
                              />
                              <span>Enabled</span>
                            </label>
                          {:else if typeof editedJobData[key] === 'number'}
                            <input
                              type="number"
                              id="job-{key}"
                              bind:value={editedJobData[key]}
                              class="form-input"
                              class:readonly={isReadonlyField(key)}
                              readonly={isReadonlyField(key)}
                            />
                          {:else}
                            <input
                              type="text"
                              id="job-{key}"
                              bind:value={editedJobData[key]}
                              class="form-input"
                              class:readonly={isReadonlyField(key)}
                              readonly={isReadonlyField(key)}
                            />
                          {/if}
                        </div>
                      {:else}
                        <div class="form-field nested">
                          <div class="nested-label">
                            {getFieldLabel(key)}
                            <span class="field-badge">Object</span>
                          </div>
                          <div class="nested-object">
                            {#each Object.keys(editedJobData[key]) as nestedKey}
                              <div class="nested-field">
                                <label for="job-{key}-{nestedKey}" class="nested-field-label">
                                  {getFieldLabel(nestedKey)}
                                  {#if isReadonlyField(nestedKey)}
                                    <span class="field-badge readonly small">Readonly</span>
                                  {/if}
                                </label>
                                {#if typeof editedJobData[key][nestedKey] === 'boolean'}
                                  <label class="checkbox-label">
                                    <input
                                      type="checkbox"
                                      id="job-{key}-{nestedKey}"
                                      bind:checked={editedJobData[key][nestedKey]}
                                      disabled={isReadonlyField(nestedKey)}
                                    />
                                    <span>Enabled</span>
                                  </label>
                                {:else if typeof editedJobData[key][nestedKey] === 'number'}
                                  <input
                                    type="number"
                                    id="job-{key}-{nestedKey}"
                                    bind:value={editedJobData[key][nestedKey]}
                                    class="form-input nested"
                                    class:readonly={isReadonlyField(nestedKey)}
                                    readonly={isReadonlyField(nestedKey)}
                                  />
                                {:else}
                                  <input
                                    type="text"
                                    id="job-{key}-{nestedKey}"
                                    bind:value={editedJobData[key][nestedKey]}
                                    class="form-input nested"
                                    class:readonly={isReadonlyField(nestedKey)}
                                    readonly={isReadonlyField(nestedKey)}
                                  />
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                  <div class="edit-hint">
                    💡 <strong>Tip:</strong> Edit fields directly in the form. Changes apply to this session only (not saved to file).
                  </div>
                {:else}
                  <pre class="job-text">{jobDescription}</pre>
                {/if}
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
  /* Resume Selector Section */
  .resume-selector-section {
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 20px;
  }

  .resume-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    padding: 20px;
    color: inherit;
    opacity: 0.7;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(102, 126, 234, 0.2);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .resume-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 30px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }

  .resume-empty p {
    margin: 0;
    font-size: 0.95rem;
    color: inherit;
    opacity: 0.7;
  }

  .resume-empty a {
    color: #667eea;
    text-decoration: underline;
    font-weight: 600;
  }

  .resume-selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    color: inherit;
    cursor: pointer;
  }

  .label-icon {
    font-size: 1.1rem;
  }

  .label-text {
    color: inherit;
  }

  .selector-wrapper {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .resume-dropdown {
    flex: 1;
    padding: 10px 14px;
    font-size: 0.95rem;
    font-family: inherit;
    border: 2px solid rgba(102, 126, 234, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    cursor: pointer;
    transition: all 0.2s;
  }

  .resume-dropdown:hover {
    border-color: #667eea;
  }

  .resume-dropdown:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }

  .refresh-icon-btn {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-icon-btn:hover:not(:disabled) {
    background: rgba(102, 126, 234, 0.1);
    border-color: #667eea;
  }

  .refresh-icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .resume-loaded-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(40, 167, 69, 0.1);
    border-left: 3px solid #28a745;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .indicator-icon {
    color: #28a745;
    font-weight: bold;
    font-size: 1rem;
  }

  .indicator-text {
    color: inherit;
    opacity: 0.8;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: inherit;
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

  .prompt-hint {
    padding: 10px 15px;
    background: rgba(102, 126, 234, 0.1);
    border-left: 4px solid #667eea;
    margin-top: 10px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: inherit;
  }

  .header-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .add-job-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .add-job-btn:hover {
    background: #5568d3;
    transform: translateY(-1px);
  }

  /* Job Form */
  .job-form {
    background: rgba(102, 126, 234, 0.05);
    border: 2px solid #667eea;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .form-title {
    margin: 0 0 20px 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #667eea;
  }

  .form-group {
    margin-bottom: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    color: inherit;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .form-group textarea {
    font-family: 'Monaco', 'Courier New', monospace;
    resize: vertical;
  }

  .save-job-btn {
    width: 100%;
    background: #28a745;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .save-job-btn:hover {
    background: #218838;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }

  /* Content Section */
  .content-section {
    padding: 25px;
  }

  .job-meta {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    background: rgba(128, 128, 128, 0.1);
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 0.9rem;
    color: inherit;
    opacity: 0.8;
  }

  .edit-btn {
    margin-left: auto;
    background: #667eea;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .edit-btn:hover {
    background: #5568d3;
    transform: translateY(-1px);
  }

  .edit-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  .save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .save-btn:hover {
    background: #218838;
    transform: translateY(-1px);
  }

  .cancel-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 12px 30px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .cancel-btn:hover {
    background: #c82333;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  .clear-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 12px 30px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .clear-btn:hover {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  .job-text-editor {
    width: 100%;
    padding: 20px;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
    border: 2px solid #667eea;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    resize: vertical;
    min-height: 400px;
  }

  .job-text-editor:focus {
    outline: none;
    border-color: #5568d3;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .edit-hint {
    padding: 12px 18px;
    background: rgba(102, 126, 234, 0.1);
    border-left: 4px solid #667eea;
    margin-top: 10px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: inherit;
  }

  .job-description-content {
    padding: 20px;
  }

  /* Dynamic Form Styles */
  .dynamic-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 10px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field label {
    font-weight: 600;
    font-size: 0.95rem;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(102, 126, 234, 0.2);
    color: #667eea;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .field-badge.readonly {
    background: rgba(128, 128, 128, 0.2);
    color: #666;
  }

  .field-badge.small {
    font-size: 0.65rem;
    padding: 1px 6px;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .form-input.readonly,
  .form-input:read-only {
    background: rgba(128, 128, 128, 0.1);
    color: #666;
    cursor: not-allowed;
    border-color: rgba(128, 128, 128, 0.2);
  }

  .form-input.readonly:focus,
  .form-input:read-only:focus {
    border-color: rgba(128, 128, 128, 0.3);
    box-shadow: none;
  }

  .form-textarea {
    width: 100%;
    padding: 12px 15px;
    border: 2px solid rgba(128, 128, 128, 0.3);
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: 'Monaco', 'Courier New', monospace;
    background: rgba(255, 255, 255, 0.8);
    color: inherit;
    resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-textarea.large {
    min-height: 200px;
  }

  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  /* Nested Object Styles */
  .form-field.nested {
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    padding: 15px;
  }

  .nested-label {
    font-size: 1rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 10px;
  }

  .nested-object {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .nested-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nested-field-label {
    font-weight: 500;
    font-size: 0.85rem;
    color: rgba(0, 0, 0, 0.7);
  }

  .form-input.nested {
    font-size: 0.85rem;
    padding: 8px 10px;
  }

  /* Scrollbar Styling */
  .dynamic-form::-webkit-scrollbar {
    width: 8px;
  }

  .dynamic-form::-webkit-scrollbar-track {
    background: rgba(128, 128, 128, 0.1);
    border-radius: 4px;
  }

  .dynamic-form::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.5);
    border-radius: 4px;
  }

  .dynamic-form::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 126, 234, 0.7);
  }

  .job-text {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
    color: inherit;
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
