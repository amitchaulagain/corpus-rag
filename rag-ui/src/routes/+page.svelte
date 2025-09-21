<script lang="ts">
  import FileUpload from '$lib/components/FileUpload.svelte';
  import GoogleAuth from '$lib/components/GoogleAuth.svelte';

  let isAuthenticated = false;
  let user: any = null;
  let accessToken = '';
  let userId = '';
  let question = '';
  let queryResponse = '';
  let queryMessage = '';
  let isQuerying = false;
  let userFiles: any[] = [];
  let isLoadingFiles = false;
  let isUploading = false;
  let uploadMessage = '';
  let isDragOver = false;
  let fileInput: HTMLInputElement;

  async function handleUpload(event: CustomEvent) {
    const { success, files, error } = event.detail;

    if (success) {
      console.log('✅ Files uploaded successfully:', files);

      // Refresh user files list
      await loadUserFiles();

      // Optionally auto-import to RAG
      if (files && files.length > 0) {
        await importToRAG(files);
      }
    } else {
      console.error('❌ Upload failed:', error);
    }
  }

  async function loadUserFiles() {
    if (!userId.trim()) return;

    isLoadingFiles = true;
    try {
      const response = await fetch(`/api/storage/list?userId=${encodeURIComponent(userId)}`);
      const result = await response.json();

      if (result.success) {
        userFiles = result.files || [];
      } else {
        console.error('Failed to load files:', result.error);
        userFiles = [];
      }
    } catch (error) {
      console.error('Error loading files:', error);
      userFiles = [];
    } finally {
      isLoadingFiles = false;
    }
  }

  async function importToRAG(files: any[]) {
    try {
      const cloudStorageUris = files.map(f => f.fileId);

      const response = await fetch('/api/rag/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cloudStorageUris })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Import to RAG started:', result.message);
      } else {
        console.error('❌ Import failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Import error:', error);
    }
  }

  async function queryRAG() {
    if (!userId.trim() || !question.trim()) return;

    isQuerying = true;
    queryMessage = '';
    queryResponse = '';

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, question })
      });

      const result = await response.json();

      if (result.success) {
        queryResponse = result.answer;
        queryMessage = 'Query completed successfully';
      } else {
        queryMessage = `Error: ${result.error}`;
      }
    } catch (error) {
      queryMessage = `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isQuerying = false;
    }
  }

  async function handleAuthenticated(event: CustomEvent) {
    const { user: authUser, token } = event.detail;
    isAuthenticated = true;
    user = authUser;
    accessToken = token;
    userId = authUser.email; // Use email as unique user ID

    // Create user folder and load files after authentication
    await createUserFolder();
    await loadUserFiles();
  }

  async function createUserFolder() {
    if (!userId.trim()) return;

    try {
      const response = await fetch('/api/storage/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();
      if (!result.success) {
        console.error('Failed to create user folder:', result.error);
      }
    } catch (error) {
      console.error('Error creating user folder:', error);
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    accessToken = '';
    userId = '';
    userFiles = [];
    queryResponse = '';
    queryMessage = '';
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      await uploadFile(file);
    }
  }

  async function uploadFile(file: File, replaceExisting = false) {
    if (!userId.trim()) {
      uploadMessage = 'User ID is required';
      return;
    }

    isUploading = true;
    uploadMessage = '';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      if (replaceExisting) {
        formData.append('replaceExisting', 'true');
      }

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        uploadMessage = result.error || 'Upload failed';
        return;
      }

      uploadMessage = 'Resume uploaded successfully!';
      await loadUserFiles();

      // Auto-import to RAG
      if (result.file) {
        await importToRAG([result.file]);
      }

    } catch (error) {
      uploadMessage = `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isUploading = false;
    }
  }

  async function deleteResume(fileName: string) {
    if (!confirm('Are you sure you want to delete your resume?')) return;

    try {
      const response = await fetch('/api/storage/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fileName })
      });

      const result = await response.json();

      if (result.success) {
        uploadMessage = 'Resume deleted successfully';
        await loadUserFiles();
      } else {
        uploadMessage = `Delete failed: ${result.error}`;
      }
    } catch (error) {
      uploadMessage = `Delete error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async function replaceResume() {
    fileInput?.click();
    // When file is selected, upload with replaceExisting = true
    const originalOnChange = fileInput?.onchange;
    if (fileInput) {
      fileInput.onchange = async (event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
          await uploadFile(file, true);
        }
        // Restore original onchange
        fileInput.onchange = originalOnChange;
      };
    }
  }
</script>

<svelte:head>
  <title>RAG System - Cloud Storage</title>
  <meta name="description" content="Secure RAG system with Google Cloud Storage" />
</svelte:head>

<div class="container">
  <header class="header">
    <h1>🚀 RAG System</h1>
    <p>Secure file storage with Google Cloud Storage + Vertex AI RAG</p>
  </header>

  <main class="content">
    <!-- Authentication -->
    <GoogleAuth
      on:authenticated={handleAuthenticated}
      on:logout={handleLogout}
    />

    {#if isAuthenticated && userId}

    <!-- Resume Management -->
    <section class="section">
      <h2>📄 Your Resume</h2>
      <p>Upload one resume for RAG analysis. You can delete and replace it anytime.</p>

      {#if userFiles.length > 0}
        <div class="resume-card">
          <div class="resume-icon">📄</div>
          <div class="resume-info">
            <div class="resume-name">{userFiles[0].name}</div>
            <div class="resume-meta">
              <span class="resume-size">{userFiles[0].size ? `${Math.round(parseInt(userFiles[0].size) / 1024)} KB` : ''}</span>
              <span class="resume-date">
                {userFiles[0].created ? new Date(userFiles[0].created).toLocaleDateString() : ''}
              </span>
            </div>
          </div>
          <div class="resume-actions">
            <button class="btn danger" onclick={() => deleteResume(userFiles[0].name)}>
              🗑️ Delete
            </button>
            <button class="btn secondary" onclick={() => replaceResume()}>
              🔄 Replace
            </button>
          </div>
        </div>
      {:else}
        <div class="upload-zone" class:drag-over={isDragOver}
             ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
             ondragleave={() => isDragOver = false}
             ondrop={handleDrop}>
          <div class="upload-content">
            <div class="upload-icon">📤</div>
            <h3>Upload Your Resume</h3>
            <p>Drag and drop your resume here, or click to select</p>
            <input type="file" accept=".pdf,.txt,.docx,.md" onchange={handleFileSelect} style="display: none;" bind:this={fileInput} />
            <button class="btn" onclick={() => fileInput?.click()}>
              Choose File
            </button>
          </div>
        </div>
      {/if}

      {#if isUploading}
        <div class="loading">
          <div class="spinner"></div>
          Uploading your resume...
        </div>
      {/if}

      {#if uploadMessage}
        <div class="response" class:success={uploadMessage.includes('success')} class:error={!uploadMessage.includes('success')}>
          {uploadMessage}
        </div>
      {/if}
    </section>

    <!-- Query Interface -->
    <section class="section">
      <h2>❓ Ask Questions</h2>
      <p>Query your uploaded documents using natural language.</p>

      <div class="form-group">
        <label for="question">Question:</label>
        <textarea
          id="question"
          bind:value={question}
          placeholder="What would you like to know about your documents?"
          rows="3"
        ></textarea>
      </div>

      <button
        class="btn"
        onclick={queryRAG}
        disabled={isQuerying || !userId.trim() || !question.trim()}
      >
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
          <h4>💡 Answer:</h4>
          <p>{queryResponse}</p>
        </div>
      {/if}
    </section>

    {/if}
  </main>
</div>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    margin: 0;
    padding: 20px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
    color: white;
    padding: 40px;
    text-align: center;
  }

  .header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    font-weight: 700;
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
    border-radius: 12px;
    background: #f8f9fa;
  }

  .section h2 {
    color: #2c3e50;
    margin-bottom: 20px;
    font-size: 1.5rem;
    font-weight: 600;
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
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn.secondary {
    background: #6c757d;
    background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  }

  .files-header {
    margin-bottom: 20px;
  }

  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .file-card {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: flex-start;
    gap: 15px;
    transition: box-shadow 0.2s;
  }

  .file-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .file-icon {
    font-size: 2rem;
    opacity: 0.7;
  }

  .file-info {
    flex: 1;
  }

  .file-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 5px;
    word-break: break-all;
  }

  .file-meta {
    display: flex;
    gap: 10px;
    margin-bottom: 5px;
  }

  .file-size,
  .file-type {
    font-size: 12px;
    color: #666;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .file-date {
    font-size: 12px;
    color: #666;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .empty-state p {
    margin: 10px 0;
  }

  .response {
    margin-top: 20px;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid;
  }

  .response.success {
    background: #d4edda;
    border-left-color: #28a745;
    color: #155724;
  }

  .response.error {
    background: #f8d7da;
    border-left-color: #dc3545;
    color: #721c24;
  }

  .response h4 {
    margin: 0 0 10px 0;
    font-weight: 600;
  }

  .response p {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 20px 0;
    color: #666;
  }

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 24px;
    height: 24px;
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

  .upload-zone {
    border: 2px dashed #ddd;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    background: white;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .upload-zone:hover,
  .upload-zone.drag-over {
    border-color: #667eea;
    background: #f8f9ff;
  }

  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
  }

  .upload-icon {
    font-size: 3rem;
    opacity: 0.7;
  }

  .upload-content h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.5rem;
  }

  .upload-content p {
    margin: 0;
    color: #666;
  }

  .resume-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .resume-icon {
    font-size: 2.5rem;
    opacity: 0.7;
  }

  .resume-info {
    flex: 1;
  }

  .resume-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 5px;
    font-size: 1.1rem;
  }

  .resume-meta {
    display: flex;
    gap: 15px;
  }

  .resume-size,
  .resume-date {
    font-size: 12px;
    color: #666;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .resume-actions {
    display: flex;
    gap: 10px;
  }

  .btn.danger {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  }

  .btn.danger:hover {
    box-shadow: 0 8px 25px rgba(220, 53, 69, 0.3);
  }
</style>