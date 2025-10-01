<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  type LocalUser = { name?: string; email: string; picture?: string } | null;

  let user: LocalUser = null;
  let coverLetterPrompt: string = '';
  let lastSavedPrompt: string = '';
  let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
  let initialLoaded: boolean = false;

  let jobText: string = '';
  let isGenerating: boolean = false;
  let generatedCoverLetter: string = '';

  $: if (initialLoaded) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (coverLetterPrompt && coverLetterPrompt !== lastSavedPrompt) {
        savePrompt(coverLetterPrompt);
      }
    }, 700);
  }

  onMount(async () => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
    }

    try {
      const response = await apiRequest('/api/prompts/cover-letter');
      const data = await response.json();
      coverLetterPrompt = data.content;
      lastSavedPrompt = data.content || '';
      initialLoaded = true;
    } catch (error) {
      console.error('Failed to load prompt:', error);
      coverLetterPrompt = `Write a compelling cover letter for this position: [Job Details]\n\nUse my background from the resume and user info to:\n- Address their specific pain points mentioned in the job posting\n- Highlight 2-3 most relevant experiences\n- Match their company tone/culture if discernible\n- Keep it under 300 words\n- End with a strong call to action\n\nPlease format as a professional cover letter with proper greeting and closing.`;
      initialLoaded = true;
    }
  });

  async function savePrompt(content: string) {
    try {
      const response = await apiRequest('/api/prompts/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const result = await response.json().catch(() => ({}));
      if (result && result.success === true && result.changed) {
        lastSavedPrompt = content;
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  async function generateCoverLetter() {
    if (!user) {
      alert('Please sign in with Google to generate a cover letter.');
      return;
    }
    if (!jobText.trim()) return;

    isGenerating = true;
    generatedCoverLetter = '';
    try {
      const response = await apiRequest('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cover_letter',
          jobDetails: { details: jobText },
          userEmail: user.email,
          customPrompt: coverLetterPrompt
        })
      });
      const data = await response.json();
      if (data.success) {
        generatedCoverLetter = data.data.generatedText;
      } else {
        alert('Failed to generate cover letter: ' + data.error);
      }
    } catch (error) {
      const err = error as Error;
      console.error('Failed to generate cover letter:', err);
      alert('Failed to generate cover letter: ' + (err?.message || 'Unknown error'));
    } finally {
      isGenerating = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }
</script>

<main class="container mx-auto max-w-5xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">✍️ Cover Letter Test</h1>
    <p class="text-base-content/70">Enter a job description and generate a cover letter</p>

    <div class="prompt-section">
      <h3>🤖 AI Prompt Editor</h3>
      <div class="prompt-container">
        <div class="prompt-area">
          <textarea
            class="prompt-editor"
            bind:value={coverLetterPrompt}
            placeholder="Enter your AI prompt here..."
            rows="6"
          ></textarea>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="section">
      <h3>📋 Job Description</h3>
      <textarea
        class="job-editor"
        bind:value={jobText}
        placeholder="Paste or type the job description here..."
        rows="14"
      ></textarea>

      <div class="actions">
        <button class="generate-btn" on:click={generateCoverLetter} disabled={isGenerating || !jobText.trim()}>
          {#if isGenerating}
            ⏳ Generating Cover Letter...
          {:else}
            ✍️ Generate Cover Letter
          {/if}
        </button>
      </div>
    </div>

    {#if generatedCoverLetter}
      <div class="section">
        <div class="section-header">
          <h3>📝 Your Cover Letter</h3>
          <div class="actions">
            <button class="copy-btn" on:click={() => copyToClipboard(generatedCoverLetter)}>📋 Copy</button>
            <button class="regenerate-btn" on:click={generateCoverLetter} disabled={isGenerating}>🔄 Regenerate</button>
          </div>
        </div>
        <div class="generated-content">
          <pre class="cover-letter-text">{generatedCoverLetter}</pre>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }

  .prompt-section {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
  }

  .prompt-section h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .prompt-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .prompt-editor {
    width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.5;
    resize: vertical;
    background: white;
    color: #333;
    min-height: 200px;
  }

  .prompt-editor:focus {
    outline: none;
    border-color: #007acc;
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .panel {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    overflow: hidden;
  }

  .section {
    padding: 20px;
    border-bottom: 1px solid #e9ecef;
  }

  .section:last-child {
    border-bottom: 0;
  }

  .job-editor {
    width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 15px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 0.95rem;
    line-height: 1.5;
    min-height: 320px;
    background: #fff;
    color: #333;
    resize: vertical;
  }

  .actions {
    margin-top: 12px;
    display: flex;
    gap: 10px;
  }

  .generate-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: #218838;
  }

  .generate-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .copy-btn {
    background: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .copy-btn:hover {
    background: #138496;
  }

  .regenerate-btn {
    background: #ffc107;
    color: #212529;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .regenerate-btn:hover:not(:disabled) {
    background: #e0a800;
  }

  .regenerate-btn:disabled {
    background: #6c757d;
    color: white;
    cursor: not-allowed;
  }

  .generated-content {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 20px;
    margin-top: 8px;
  }

  .cover-letter-text {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: Georgia, serif;
    line-height: 1.7;
    color: #333;
    font-size: 1.05rem;
  }

  @media (max-width: 1024px) {
    .container {
      padding: 15px;
    }
  }
</style>

