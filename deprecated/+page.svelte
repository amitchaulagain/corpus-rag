<script lang="ts">
  import { onMount } from 'svelte';
  import { listDriveFiles, ingestFiles, queryRag } from '$lib/api.js';
  import { formatFileSize, extractFolderIdFromUrl } from '$lib/utils.js';
  import type { DriveFile } from '$lib/types.js';

  let folderUrl = 'https://drive.google.com/drive/folders/1X7GG2eOSn51o0bRAQvBLIyA_gakb1ct4?usp=drive_link';
  let files: DriveFile[] = [];
  let selectedFiles: Set<string> = new Set();
  let isLoadingFiles = false;
  let isIngesting = false;
  let isQuerying = false;
  let loadFilesMessage = '';
  let ingestMessage = '';
  let queryMessage = '';
  let queryResponse = '';
  let userId = '';
  let question = '';

  async function loadFiles() {
    if (!folderUrl.trim()) return;

    isLoadingFiles = true;
    loadFilesMessage = '';
    files = [];
    selectedFiles.clear();

    try {
      const folderId = extractFolderIdFromUrl(folderUrl);
      const response = await listDriveFiles(folderId);

      if (response.success && response.data) {
        files = response.data;
        loadFilesMessage = `Found ${files.length} files`;
      } else {
        loadFilesMessage = `Error: ${response.error}`;
      }
    } catch (error) {
      loadFilesMessage = `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isLoadingFiles = false;
    }
  }

  function toggleFileSelection(fileId: string) {
    if (selectedFiles.has(fileId)) {
      selectedFiles.delete(fileId);
    } else {
      selectedFiles.add(fileId);
    }
    selectedFiles = selectedFiles; // Trigger reactivity
  }

  async function importSelectedFiles() {
    if (selectedFiles.size === 0) {
      alert('Please select at least one file to import.');
      return;
    }

    const enteredUserId = prompt('Enter your User ID:');
    if (!enteredUserId) return;

    isIngesting = true;
    ingestMessage = '';

    try {
      const response = await ingestFiles({
        user_id: enteredUserId,
        drive_file_ids: Array.from(selectedFiles)
      });

      if (response.success) {
        ingestMessage = `Successfully imported ${selectedFiles.size} files!`;
        selectedFiles.clear();
        selectedFiles = selectedFiles; // Trigger reactivity
      } else {
        ingestMessage = `Error: ${response.error}`;
      }
    } catch (error) {
      ingestMessage = `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isIngesting = false;
    }
  }

  async function handleQuery(event: Event) {
    event.preventDefault();

    if (!userId.trim() || !question.trim()) return;

    isQuerying = true;
    queryMessage = '';
    queryResponse = '';

    try {
      const response = await queryRag({
        user_id: userId,
        question: question
      });

      if (response.success && response.data) {
        queryResponse = response.data.answer;
        queryMessage = 'Query completed successfully';
      } else {
        queryMessage = `Error: ${response.error}`;
      }
    } catch (error) {
      queryMessage = `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isQuerying = false;
    }
  }
</script>

<svelte:head>
  <title>RAG System</title>
  <meta name="description" content="Retrieval-Augmented Generation with Google Drive Integration" />
</svelte:head>

<div class="container">
  <header class="header">
    <h1>RAG System</h1>
    <p>Retrieval-Augmented Generation with Google Drive Integration</p>
  </header>

  <main class="content">
    <!-- Google Drive File Browser -->
    <section class="section">
      <h2>📁 Browse Google Drive</h2>
      <p>Browse and select files from your Google Drive folder.</p>

      <div class="form-group">
        <label for="folderUrl">Google Drive Folder URL:</label>
        <input
          id="folderUrl"
          type="text"
          bind:value={folderUrl}
          placeholder="Enter Google Drive folder URL"
        />
        <div class="help-text">Paste your Google Drive folder URL</div>
      </div>

      <button type="button" class="btn" onclick={loadFiles} disabled={isLoadingFiles}>
        {isLoadingFiles ? 'Loading...' : 'Load Files'}
      </button>

      {#if isLoadingFiles}
        <div class="loading">
          <div class="spinner"></div>
          Loading files...
        </div>
      {/if}

      {#if loadFilesMessage}
        <div class="response" class:success={files.length > 0} class:error={files.length === 0}>
          {loadFilesMessage}
        </div>
      {/if}

      {#if files.length > 0}
        <div class="files-list">
          <h3>Select Files to Import:</h3>
          <div class="files-container">
            {#each files as file (file.id)}
              <div class="file-item">
                <input
                  type="checkbox"
                  id="file_{file.id}"
                  checked={selectedFiles.has(file.id)}
                  onchange={() => toggleFileSelection(file.id)}
                />
                <label for="file_{file.id}">
                  <div class="file-name">{file.name}</div>
                  <div class="file-info">
                    {file.mimeType}{file.size ? ` • ${formatFileSize(file.size)}` : ''}
                  </div>
                </label>
              </div>
            {/each}
          </div>

          {#if selectedFiles.size > 0}
            <button
              type="button"
              class="btn"
              onclick={importSelectedFiles}
              disabled={isIngesting}
            >
              {isIngesting ? 'Importing...' : `Import ${selectedFiles.size} Selected Files`}
            </button>
          {/if}

          {#if isIngesting}
            <div class="loading">
              <div class="spinner"></div>
              Importing documents...
            </div>
          {/if}

          {#if ingestMessage}
            <div class="response" class:success={ingestMessage.includes('Successfully')} class:error={!ingestMessage.includes('Successfully')}>
              {ingestMessage}
            </div>
          {/if}
        </div>
      {/if}
    </section>

    <!-- Ask Questions -->
    <section class="section">
      <h2>❓ Ask Questions</h2>
      <p>Query your imported documents using natural language.</p>

      <form onsubmit={handleQuery}>
        <div class="form-group">
          <label for="queryUserId">User ID:</label>
          <input
            id="queryUserId"
            type="text"
            bind:value={userId}
            required
            placeholder="Enter your User ID"
          />
          <div class="help-text">Same User ID used when importing documents</div>
        </div>

        <div class="form-group">
          <label for="question">Question:</label>
          <textarea
            id="question"
            bind:value={question}
            required
            placeholder="What would you like to know about your documents?"
          ></textarea>
        </div>

        <button type="submit" class="btn" disabled={isQuerying || !userId.trim() || !question.trim()}>
          {isQuerying ? 'Searching...' : 'Ask Question'}
        </button>

        {#if isQuerying}
          <div class="loading">
            <div class="spinner"></div>
            Searching and generating answer...
          </div>
        {/if}

        {#if queryMessage}
          <div class="response" class:success={queryMessage.includes('successfully')} class:error={!queryMessage.includes('successfully')}>
            {queryMessage}
          </div>
        {/if}

        {#if queryResponse}
          <div class="response success">
            <h4>Answer:</h4>
            <p>{queryResponse}</p>
          </div>
        {/if}
      </form>
    </section>
  </main>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .header {
    background: #2c3e50;
    color: white;
    padding: 30px;
    text-align: center;
  }

  .header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
  }

  .header p {
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .content {
    padding: 40px;
  }

  .section {
    margin-bottom: 40px;
    padding: 30px;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    background: #f8f9fa;
  }

  .section h2 {
    color: #2c3e50;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #555;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.3s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 100px;
  }

  .btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 30px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
  }

  .btn:active {
    transform: translateY(0);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .response {
    margin-top: 20px;
    padding: 20px;
    border-radius: 6px;
  }

  .response.success {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
  }

  .response.error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
  }

  .loading {
    text-align: center;
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .help-text {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
  }

  .files-list {
    margin-top: 20px;
  }

  .files-container {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 10px;
    margin: 10px 0;
  }

  .file-item {
    padding: 10px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-item label {
    flex: 1;
    cursor: pointer;
    margin-bottom: 0;
  }

  .file-name {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .file-info {
    font-size: 12px;
    color: #666;
  }

  .response h4 {
    margin-bottom: 10px;
    font-weight: 600;
  }

  .response p {
    margin: 0;
    white-space: pre-wrap;
  }
</style>