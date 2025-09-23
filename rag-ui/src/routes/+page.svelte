<script lang="ts">
  import { onDestroy } from 'svelte';
  import FileUpload from '$lib/components/FileUpload.svelte';
  import GoogleAuth from '$lib/components/GoogleAuth.svelte';
  import ApiTester from '$lib/components/ApiTester.svelte';
  import ApiHealthMonitor from '$lib/components/ApiHealthMonitor.svelte';
  import EmbeddedTestRunner from '$lib/components/EmbeddedTestRunner.svelte';

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

  // Corpus management
  let corpora: any[] = [];
  let isLoadingCorpora = false;
  let userCorpus: any = null;
  let isLoadingUserCorpus = false;

  // Console logs
  let consoleLogs: Array<{id: number, timestamp: string, type: 'info' | 'success' | 'error' | 'warning', message: string}> = [];
  let nextLogId = 1;

  // UI state
  let activeTab = 'upload'; // 'upload', 'query', 'corpus', 'logs', 'files', 'api'
  let showDocumentPreview = false;
  let selectedDocument: any = null;

  // Files management
  let allCloudFiles: any[] = [];
  let vertexFiles: any[] = [];
  let isLoadingCloudFiles = false;
  let isLoadingVertexFiles = false;
  let currentCloudPath = '';
  let operationsStatus: Map<string, any> = new Map();
  let bucketName = 'Loading...';
  let statusMonitorInterval: NodeJS.Timeout | null = null;

  function addLog(type: 'info' | 'success' | 'error' | 'warning', message: string) {
    const log = {
      id: nextLogId++,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    consoleLogs = [log, ...consoleLogs].slice(0, 100); // Keep last 100 logs
  }

  async function handleUpload(event: CustomEvent) {
    const { success, files, error } = event.detail;

    if (success) {
      addLog('success', `✅ Files uploaded successfully: ${files?.map((f: any) => f.name).join(', ')}`);
      await loadUserFiles();
      if (files && files.length > 0) {
        await importToRAG(files);
      }
    } else {
      addLog('error', `❌ Upload failed: ${error}`);
    }
  }

  async function loadUserFiles() {
    if (!userId.trim()) return;

    isLoadingFiles = true;
    addLog('info', `📁 Loading files for user: ${userId}`);

    try {
      const response = await fetch(`/api/storage/list?userId=${encodeURIComponent(userId)}`);
      const result = await response.json();

      if (result.success) {
        userFiles = result.files || [];
        addLog('success', `✅ Found ${userFiles.length} files in storage`);
      } else {
        addLog('error', `❌ Failed to load files: ${result.error}`);
        userFiles = [];
      }
    } catch (error) {
      addLog('error', `❌ Error loading files: ${error}`);
      userFiles = [];
    } finally {
      isLoadingFiles = false;
    }
  }

  async function loadCorpora() {
    isLoadingCorpora = true;
    addLog('info', '📦 Loading all corpora from Vertex AI...');

    try {
      const response = await fetch('/api/corpus/list');
      const result = await response.json();

      if (result.success) {
        corpora = result.corpora || [];
        addLog('success', `✅ Found ${corpora.length} corpora in project`);
      } else {
        addLog('error', `❌ Failed to load corpora: ${result.error}`);
        corpora = [];
      }
    } catch (error) {
      addLog('error', `❌ Error loading corpora: ${error}`);
      corpora = [];
    } finally {
      isLoadingCorpora = false;
    }
  }

  async function loadUserCorpus() {
    if (!userId.trim()) return;

    // Prevent multiple concurrent calls
    if (isLoadingUserCorpus) {
      addLog('warning', `⏳ Already loading corpus for user: ${userId}`);
      return;
    }

    isLoadingUserCorpus = true;
    addLog('info', `🔍 Getting corpus for user: ${userId}`);

    try {
      const response = await fetch('/api/corpus/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const result = await response.json();

      if (result.success) {
        userCorpus = result;
        addLog('success', `✅ User corpus ${result.exists ? 'found' : 'created'}: ${result.corpusId}`);
      } else {
        addLog('error', `❌ Failed to get user corpus: ${result.error}`);
        userCorpus = null;
      }
    } catch (error) {
      addLog('error', `❌ Error getting user corpus: ${error}`);
      userCorpus = null;
    } finally {
      isLoadingUserCorpus = false;
    }
  }

  async function importToRAG(files: any[]) {
    addLog('info', `⬆️ Starting RAG import for ${files.length} files...`);

    try {
      const cloudStorageUris = files.map(f => f.fileId);

      const response = await fetch('/api/rag/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cloudStorageUris })
      });

      const result = await response.json();

      if (result.success) {
        addLog('success', `✅ RAG import started: ${result.message}`);
        addLog('info', `📊 Operation ID: ${result.operationId}`);
      } else {
        addLog('error', `❌ RAG import failed: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ RAG import error: ${error}`);
    }
  }

  async function queryRAG() {
    if (!userId.trim() || !question.trim()) return;

    isQuerying = true;
    queryMessage = '';
    queryResponse = '';
    addLog('info', `🤔 Querying RAG: "${question}"`);

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
        addLog('success', '✅ RAG query completed successfully');
      } else {
        queryMessage = `Error: ${result.error}`;
        addLog('error', `❌ RAG query failed: ${result.error}`);
      }
    } catch (error) {
      queryMessage = `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      addLog('error', `❌ RAG query network error: ${error}`);
    } finally {
      isQuerying = false;
    }
  }

  async function handleAuthenticated(event: CustomEvent) {
    const { user: authUser, token } = event.detail;
    isAuthenticated = true;
    user = authUser;
    accessToken = token;
    userId = authUser.email;

    addLog('success', `👤 User authenticated: ${userId}`);

    // Run operations sequentially to prevent concurrent corpus creation
    await createUserFolder();
    await loadUserCorpus(); // Load corpus first before files to ensure it exists
    await loadUserFiles();
    await loadCorpora();
  }

  async function createUserFolder() {
    if (!userId.trim()) return;

    addLog('info', '📁 Creating user folder in cloud storage...');

    try {
      const response = await fetch('/api/storage/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();
      if (result.success) {
        addLog('success', '✅ User folder created/verified');
      } else {
        addLog('error', `❌ Failed to create user folder: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ Error creating user folder: ${error}`);
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    accessToken = '';
    userId = '';
    userFiles = [];
    corpora = [];
    userCorpus = null;
    queryResponse = '';
    queryMessage = '';
    consoleLogs = [];
    operationsStatus.clear();
    stopOperationMonitoring();
    addLog('info', '👋 User logged out');
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
      addLog('error', '❌ User ID is required for upload');
      return;
    }

    isUploading = true;
    uploadMessage = '';
    addLog('info', `📤 Uploading file: ${file.name} (${Math.round(file.size / 1024)} KB)`);

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
        addLog('error', `❌ Upload failed: ${result.error}`);
        return;
      }

      uploadMessage = 'Resume uploaded successfully!';
      addLog('success', `✅ File uploaded: ${result.file.name}`);

      if (result.ragImport) {
        if (result.ragImport.success) {
          addLog('success', `✅ Auto-import to RAG started: ${result.ragImport.operationId}`);
          // Track the operation and refresh corpus when done
          if (result.ragImport.operationId) {
            operationsStatus.set(result.ragImport.operationId, { done: false });
            operationsStatus = operationsStatus;
            startOperationMonitoring();
          }
        } else {
          addLog('warning', `⚠️ Upload succeeded but RAG import failed: ${result.ragImport.error}`);
        }
      }

      await loadUserFiles();

    } catch (error) {
      uploadMessage = `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      addLog('error', `❌ Upload error: ${error}`);
    } finally {
      isUploading = false;
    }
  }

  async function deleteResume(fileName: string) {
    if (!confirm('Are you sure you want to delete your resume?')) return;

    addLog('info', `🗑️ Deleting file: ${fileName}`);

    try {
      const response = await fetch('/api/storage/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fileName })
      });

      const result = await response.json();

      if (result.success) {
        uploadMessage = 'Resume deleted successfully';
        addLog('success', `✅ File deleted: ${fileName}`);
        await loadUserFiles();
      } else {
        uploadMessage = `Delete failed: ${result.error}`;
        addLog('error', `❌ Delete failed: ${result.error}`);
      }
    } catch (error) {
      uploadMessage = `Delete error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      addLog('error', `❌ Delete error: ${error}`);
    }
  }

  async function replaceResume() {
    fileInput?.click();
    const originalOnChange = fileInput?.onchange;
    if (fileInput) {
      fileInput.onchange = async (event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
          await uploadFile(file, true);
        }
        fileInput.onchange = originalOnChange;
      };
    }
  }

  function previewDocument(file: any) {
    selectedDocument = file;
    showDocumentPreview = true;
    addLog('info', `👀 Previewing document: ${file.name}`);
  }

  function clearLogs() {
    consoleLogs = [];
    addLog('info', '🧹 Console logs cleared');
  }

  function setActiveTab(tab: string) {
    activeTab = tab;
    addLog('info', `📑 Switched to ${tab} tab`);

    // Auto-load data when switching to files tab
    if (tab === 'files' && isAuthenticated) {
      if (allCloudFiles.length === 0) {
        loadAllCloudFiles();
      }
      if (userCorpus && vertexFiles.length === 0) {
        loadVertexFiles();
      }
    }
  }

  async function cleanupDuplicateCorpora() {
    if (!userId.trim()) return;

    if (!confirm('⚠️ This will delete duplicate corpora for your user, keeping only the newest one. Continue?')) {
      return;
    }

    addLog('info', `🧹 Cleaning up duplicate corpora for user: ${userId}`);

    try {
      const response = await fetch('/api/corpus/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        // Refresh the corpora list
        await loadCorpora();
        await loadUserCorpus();
      } else {
        addLog('error', `❌ Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ Cleanup error: ${error}`);
    }
  }

  async function syncStorageToVertexAI() {
    if (!userId.trim()) return;

    addLog('info', `🔄 Starting manual sync of cloud storage to Vertex AI for user: ${userId}`);

    try {
      const response = await fetch('/api/storage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        if (result.operationId) {
          addLog('info', `📊 Import operation ID: ${result.operationId}`);
          // Track the operation
          operationsStatus.set(result.operationId, { done: false });
          operationsStatus = operationsStatus;
          startOperationMonitoring();
        }
        if (result.files && result.files.length > 0) {
          addLog('info', `📄 Synced files: ${result.files.join(', ')}`);
        }
      } else {
        addLog('error', `❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ Sync error: ${error}`);
    }
  }

  // Files Management Functions
  async function loadAllCloudFiles() {
    isLoadingCloudFiles = true;
    addLog('info', `📁 Loading all cloud storage files...`);

    try {
      const response = await fetch(`/api/storage/browse-all?prefix=${encodeURIComponent(currentCloudPath)}`);
      const result = await response.json();

      if (result.success) {
        allCloudFiles = result.items || [];
        bucketName = result.bucketName || 'Storage';
        addLog('success', `✅ Loaded ${allCloudFiles.length} items from cloud storage`);
      } else {
        addLog('error', `❌ Failed to load cloud files: ${result.error}`);
        allCloudFiles = [];
      }
    } catch (error) {
      addLog('error', `❌ Error loading cloud files: ${error}`);
      allCloudFiles = [];
    } finally {
      isLoadingCloudFiles = false;
    }
  }

  async function loadVertexFiles() {
    if (!userCorpus?.corpusId) return;

    isLoadingVertexFiles = true;
    addLog('info', `🧠 Loading Vertex AI files for corpus: ${userCorpus.corpusId}`);

    try {
      const response = await fetch(`/api/vertex/files?corpusId=${encodeURIComponent(userCorpus.corpusId)}`);
      const result = await response.json();

      if (result.success) {
        vertexFiles = result.files || [];
        addLog('success', `✅ Loaded ${vertexFiles.length} files from Vertex AI`);
      } else {
        addLog('error', `❌ Failed to load Vertex AI files: ${result.error}`);
        vertexFiles = [];
      }
    } catch (error) {
      addLog('error', `❌ Error loading Vertex AI files: ${error}`);
      vertexFiles = [];
    } finally {
      isLoadingVertexFiles = false;
    }
  }

  function navigateCloudPath(path: string) {
    currentCloudPath = path;
    addLog('info', `📂 Navigating to: ${path || 'root'}`);
    loadAllCloudFiles();
  }

  function previewCloudFile(file: any) {
    selectedDocument = file;
    showDocumentPreview = true;
    addLog('info', `👀 Previewing cloud file: ${file.name}`);
  }

  async function syncFileToVertex(file: any) {
    if (!userId.trim()) return;

    addLog('info', `🔄 Syncing file to Vertex AI: ${file.name}`);

    try {
      const response = await fetch('/api/rag/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cloudStorageUris: [file.fileId]
        })
      });

      const result = await response.json();

      if (result.success) {
        addLog('success', `✅ File sync started: ${file.name}`);
        if (result.operationId) {
          operationsStatus.set(result.operationId, { done: false });
          operationsStatus = operationsStatus;
          startOperationMonitoring();
        }
        // Refresh corpus info and Vertex AI files
        await loadUserCorpus();
        await loadVertexFiles();
      } else {
        addLog('error', `❌ File sync failed: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ File sync error: ${error}`);
    }
  }

  async function syncAllToVertex() {
    if (!userId.trim()) return;

    addLog('info', `🔄 Syncing all user files to Vertex AI...`);

    try {
      const response = await fetch('/api/storage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        if (result.operationId) {
          operationsStatus.set(result.operationId, { done: false });
          operationsStatus = operationsStatus;
          startOperationMonitoring();
        }
        // Refresh corpus info and both file lists
        await loadUserCorpus();
        await loadVertexFiles();
      } else {
        addLog('error', `❌ Sync all failed: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ Sync all error: ${error}`);
    }
  }

  async function deleteVertexFile(ragFile: any) {
    if (!confirm(`⚠️ Delete ${ragFile.name} from Vertex AI? This cannot be undone.`)) {
      return;
    }

    addLog('info', `🗑️ Deleting Vertex AI file: ${ragFile.name}`);

    try {
      // Note: Implement delete endpoint if needed
      addLog('warning', `⚠️ Delete functionality not implemented yet`);
    } catch (error) {
      addLog('error', `❌ Delete error: ${error}`);
    }
  }

  async function checkOperationStatus(operationId: string) {
    addLog('info', `⏳ Checking operation status: ${operationId}`);

    try {
      const response = await fetch(`/api/vertex/operations?operationId=${encodeURIComponent(operationId)}`);
      const result = await response.json();

      if (result.success) {
        const operation = result.operation;
        operationsStatus.set(operationId, operation);
        operationsStatus = operationsStatus;

        if (operation.done) {
          addLog('success', `✅ Operation completed: ${operationId}`);
          // Refresh corpus info to get latest corpus ID
          await loadUserCorpus();
          // Refresh Vertex AI files
          await loadVertexFiles();
        } else {
          addLog('info', `⏳ Operation still in progress: ${operationId}`);
        }
      } else {
        addLog('error', `❌ Failed to check operation: ${result.error}`);
      }
    } catch (error) {
      addLog('error', `❌ Operation check error: ${error}`);
    }
  }

  // Auto-monitor operations status
  function startOperationMonitoring() {
    if (statusMonitorInterval) {
      clearInterval(statusMonitorInterval);
    }

    statusMonitorInterval = setInterval(async () => {
      if (operationsStatus.size === 0) return;

      const pendingOps = Array.from(operationsStatus.entries()).filter(([_, status]) => !status.done);

      if (pendingOps.length === 0) {
        clearInterval(statusMonitorInterval!);
        statusMonitorInterval = null;
        return;
      }

      for (const [opId] of pendingOps) {
        await checkOperationStatus(opId);
      }
    }, 5000); // Check every 5 seconds
  }

  function stopOperationMonitoring() {
    if (statusMonitorInterval) {
      clearInterval(statusMonitorInterval);
      statusMonitorInterval = null;
    }
  }

  // Helper function to get corpus user from display name
  function getCorpusUser(corpus: any): string {
    // New pattern: JobBot_User_email@example.com_Corpus
    if (corpus.displayName.startsWith('JobBot_User_') && corpus.displayName.endsWith('_Corpus')) {
      const match = corpus.displayName.match(/JobBot_User_(.+)_Corpus/);
      return match ? match[1] : 'Unknown';
    }
    // Legacy pattern: User email@example.com Corpus
    if (corpus.displayName.includes('User ') && corpus.displayName.includes(' Corpus')) {
      const match = corpus.displayName.match(/User (.+) Corpus/);
      return match ? match[1] : 'Unknown';
    }
    return 'System';
  }

  // Cleanup on component destroy
  onDestroy(() => {
    stopOperationMonitoring();
  });
</script>

<svelte:head>
  <title>RAG System - Job Hunting Bot Dashboard</title>
  <meta name="description" content="Per-user RAG corpus management for job hunting bot" />
</svelte:head>

<!-- API Health Monitor -->
<ApiHealthMonitor />

<div class="container">
  <header class="header">
    <h1>🤖 Job Hunting Bot - RAG Dashboard</h1>
    <p>Per-user corpus management with automatic import and AI analysis</p>
  </header>

  <main class="content">
    <!-- Authentication -->
    <GoogleAuth
      on:authenticated={handleAuthenticated}
      on:logout={handleLogout}
    />

    {#if isAuthenticated && userId}

    <!-- Tab Navigation -->
    <nav class="tab-nav">
      <button
        class="tab-btn"
        class:active={activeTab === 'upload'}
        on:click={() => setActiveTab('upload')}
      >
        📤 Upload & Files
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'query'}
        on:click={() => setActiveTab('query')}
      >
        🤔 AI Query
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'corpus'}
        on:click={() => setActiveTab('corpus')}
      >
        📦 Corpus Management
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'files'}
        on:click={() => setActiveTab('files')}
      >
        📁 File Manager
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'logs'}
        on:click={() => setActiveTab('logs')}
      >
        📜 System Logs
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'api'}
        on:click={() => setActiveTab('api')}
      >
        🚀 API Tester
      </button>
    </nav>

    <!-- Upload Tab -->
    {#if activeTab === 'upload'}
    <section class="section">
      <h2>📄 Resume Management</h2>
      <p>Upload your resume for AI analysis. Each user gets their own isolated corpus.</p>

      <!-- User Info -->
      <div class="info-card">
        <div class="info-item">
          <span class="info-label">👤 User:</span>
          <span class="info-value">{userId}</span>
        </div>
        {#if userCorpus}
        <div class="info-item">
          <span class="info-label">📦 Corpus:</span>
          <span class="info-value">{userCorpus.corpusId}</span>
          <span class="info-badge" class:new={!userCorpus.exists} class:existing={userCorpus.exists}>
            {userCorpus.exists ? 'existing' : 'new'}
          </span>
        </div>
        {/if}
      </div>

      {#if userFiles.length > 0}
        <div class="file-grid">
          {#each userFiles as file}
          <div class="file-card">
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">{file.name}</div>
              <div class="file-meta">
                <span class="file-size">{file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : ''}</span>
                <span class="file-date">
                  {file.created ? new Date(file.created).toLocaleDateString() : ''}
                </span>
              </div>
              <div class="file-path">📍 {file.fullPath}</div>
            </div>
            <div class="file-actions">
              <button class="btn-small" on:click={() => previewDocument(file)}>
                👀 Preview
              </button>
              <button class="btn-small danger" on:click={() => deleteResume(file.name)}>
                🗑️ Delete
              </button>
            </div>
          </div>
          {/each}
        </div>
      {:else}
        <div
          class="upload-zone"
          class:drag-over={isDragOver}
          role="button"
          tabindex="0"
          on:dragover|preventDefault={() => isDragOver = true}
          on:dragleave={() => isDragOver = false}
          on:drop={handleDrop}
          on:click={() => fileInput?.click()}
          on:keydown={(e) => e.key === 'Enter' && fileInput?.click()}
        >
          <div class="upload-content">
            <div class="upload-icon">📤</div>
            <h3>Upload Your Resume</h3>
            <p>Drag and drop your resume here, or click to select</p>
            <input
              type="file"
              accept=".pdf,.txt,.docx,.md"
              on:change={handleFileSelect}
              style="display: none;"
              bind:this={fileInput}
            />
            <button class="btn">Choose File</button>
          </div>
        </div>
      {/if}

      {#if userFiles.length > 0}
        <div class="upload-actions">
          <button class="btn secondary" on:click={() => replaceResume()}>
            🔄 Replace Resume
          </button>
          <button class="btn secondary" on:click={() => fileInput?.click()}>
            ➕ Add Another File
          </button>
          <button class="btn" on:click={syncStorageToVertexAI}>
            🔄 Sync to Vertex AI
          </button>
        </div>
      {/if}

      {#if isUploading}
        <div class="loading">
          <div class="spinner"></div>
          Uploading and importing to your personal corpus...
        </div>
      {/if}

      {#if uploadMessage}
        <div class="message" class:success={uploadMessage.includes('success')} class:error={!uploadMessage.includes('success')}>
          {uploadMessage}
        </div>
      {/if}
    </section>
    {/if}

    <!-- Query Tab -->
    {#if activeTab === 'query'}
    <section class="section">
      <h2>🤔 AI-Powered Resume Analysis</h2>
      <p>Ask questions about your resume. The AI will analyze your personal documents.</p>

      <div class="form-group">
        <label for="question">Question:</label>
        <textarea
          id="question"
          bind:value={question}
          placeholder="What skills do I have? What's my experience level? How can I improve my resume for a specific job?"
          rows="3"
        ></textarea>
      </div>

      <button
        class="btn"
        on:click={queryRAG}
        disabled={isQuerying || !userId.trim() || !question.trim()}
      >
        {isQuerying ? 'Analyzing...' : 'Analyze Resume'}
      </button>

      {#if isQuerying}
        <div class="loading">
          <div class="spinner"></div>
          AI is analyzing your resume and generating insights...
        </div>
      {/if}

      {#if queryMessage}
        <div class="message" class:success={queryMessage.includes('successfully')} class:error={!queryMessage.includes('successfully')}>
          {queryMessage}
        </div>
      {/if}

      {#if queryResponse}
        <div class="ai-response">
          <h4>🧠 AI Analysis:</h4>
          <div class="response-content">{queryResponse}</div>
        </div>
      {/if}
    </section>
    {/if}

    <!-- Corpus Management Tab -->
    {#if activeTab === 'corpus'}
    <section class="section">
      <h2>📦 Corpus Management Dashboard</h2>
      <p>View and manage all user corpora in your Vertex AI project.</p>

      <div class="corpus-controls">
        <button class="btn secondary" on:click={loadCorpora} disabled={isLoadingCorpora}>
          {isLoadingCorpora ? '🔄 Loading...' : '🔄 Refresh Corpora'}
        </button>
        <button class="btn secondary" on:click={loadUserCorpus} disabled={isLoadingUserCorpus}>
          {isLoadingUserCorpus ? '🔄 Loading...' : '👤 Check My Corpus'}
        </button>
        <button class="btn danger" on:click={cleanupDuplicateCorpora}>
          🧹 Cleanup Duplicates
        </button>
      </div>

      <!-- Current User Corpus -->
      {#if userCorpus}
      <div class="corpus-highlight">
        <h3>👤 Your Personal Corpus</h3>
        <div class="corpus-card current-user">
          <div class="corpus-info">
            <div class="corpus-id">🆔 {userCorpus.corpusId}</div>
            <div class="corpus-status">
              <span class="status-badge" class:new={!userCorpus.exists} class:existing={userCorpus.exists}>
                {userCorpus.exists ? 'Existing Corpus' : 'Newly Created'}
              </span>
            </div>
            <div class="corpus-user">👤 {userId}</div>
          </div>
        </div>
      </div>
      {/if}

      <!-- All Corpora -->
      <div class="corpus-section">
        <h3>🌐 All Project Corpora ({corpora.length})</h3>
        {#if isLoadingCorpora}
          <div class="loading">
            <div class="spinner"></div>
            Loading corpora from Vertex AI...
          </div>
        {:else if corpora.length > 0}
          <div class="corpus-grid">
            {#each corpora as corpus}
            <div class="corpus-card" class:current-user={getCorpusUser(corpus) === userId}>
              <div class="corpus-header">
                <div class="corpus-title">{corpus.displayName}</div>
                {#if getCorpusUser(corpus) === userId}
                  <span class="user-badge">YOU</span>
                {/if}
              </div>
              <div class="corpus-details">
                <div class="corpus-id">🆔 {corpus.corpusId}</div>
                <div class="corpus-user">👤 {getCorpusUser(corpus)}</div>
                <div class="corpus-created">📅 {new Date(corpus.createTime).toLocaleDateString()}</div>
              </div>
            </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No corpora found in project. Upload a resume to create your first corpus!</p>
          </div>
        {/if}
      </div>
    </section>
    {/if}

    <!-- Files Management Tab -->
    {#if activeTab === 'files'}
    <section class="section">
      <h2>📁 File Manager</h2>
      <p>Comprehensive view of all files in Cloud Storage and Vertex AI RAG.</p>

      <!-- File Manager Controls -->
      <div class="file-manager-controls">
        <button class="btn secondary" on:click={loadAllCloudFiles} disabled={isLoadingCloudFiles}>
          {isLoadingCloudFiles ? '🔄 Loading...' : '☁️ Refresh Cloud Storage'}
        </button>
        <button class="btn secondary" on:click={loadVertexFiles} disabled={isLoadingVertexFiles || !userCorpus}>
          {isLoadingVertexFiles ? '🔄 Loading...' : '🧠 Refresh Vertex AI Files'}
        </button>
        <button class="btn" on:click={syncAllToVertex}>
          🔄 Sync All to Vertex AI
        </button>
      </div>

      <div class="file-manager-grid">
        <!-- Cloud Storage Browser -->
        <div class="file-panel">
          <div class="panel-header">
            <h3>☁️ Cloud Storage Browser</h3>
            <div class="breadcrumb">
              <span class="bucket-name">📦 {bucketName}</span>
              {#if currentCloudPath}
                <span class="path-separator">/</span>
                <span class="current-path">{currentCloudPath}</span>
              {/if}
            </div>
          </div>

          {#if isLoadingCloudFiles}
            <div class="loading">
              <div class="spinner"></div>
              Loading cloud storage files...
            </div>
          {:else if allCloudFiles.length > 0}
            <div class="file-list">
              {#if currentCloudPath}
                <div
                  class="file-item folder"
                  role="button"
                  tabindex="0"
                  on:click={() => navigateCloudPath('')}
                  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && navigateCloudPath('')}
                >
                  <div class="file-icon">🔙</div>
                  <div class="file-info">
                    <div class="file-name">.. (Back to root)</div>
                  </div>
                </div>
              {/if}

              {#each allCloudFiles as item}
                <div
                  class="file-item"
                  class:folder={item.isFolder}
                  role="button"
                  tabindex="0"
                  on:click={() => item.isFolder ? navigateCloudPath(item.fullPath) : previewCloudFile(item)}
                  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (item.isFolder ? navigateCloudPath(item.fullPath) : previewCloudFile(item))}
                >
                  <div class="file-icon">
                    {item.isFolder ? '📁' : '📄'}
                  </div>
                  <div class="file-info">
                    <div class="file-name">{item.name}</div>
                    {#if !item.isFolder}
                      <div class="file-meta">
                        <span class="file-size">{item.size ? `${Math.round(parseInt(item.size) / 1024)} KB` : ''}</span>
                        <span class="file-date">{item.created ? new Date(item.created).toLocaleDateString() : ''}</span>
                      </div>
                      <div class="file-path">{item.fullPath}</div>
                    {/if}
                  </div>
                  {#if !item.isFolder}
                    <div class="file-actions">
                      <button class="btn-small" on:click|stopPropagation={() => syncFileToVertex(item)}>
                        🔄 Sync
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>No files found in cloud storage</p>
            </div>
          {/if}
        </div>

        <!-- Vertex AI Files -->
        <div class="file-panel">
          <div class="panel-header">
            <h3>🧠 Vertex AI RAG Files</h3>
            {#if userCorpus}
              <div class="corpus-info">
                <span class="corpus-id">Corpus: {userCorpus.corpusId}</span>
              </div>
            {/if}
          </div>

          {#if !userCorpus}
            <div class="empty-state">
              <p>No corpus found. Create a corpus first by uploading a file.</p>
            </div>
          {:else if isLoadingVertexFiles}
            <div class="loading">
              <div class="spinner"></div>
              Loading Vertex AI files...
            </div>
          {:else if vertexFiles.length > 0}
            <div class="file-list">
              {#each vertexFiles as ragFile}
                <div class="file-item vertex-file" class:error={ragFile.state !== 'ACTIVE'}>
                  <div class="file-icon">
                    {ragFile.state === 'ACTIVE' ? '✅' : ragFile.state === 'ERROR' ? '❌' : '⏳'}
                  </div>
                  <div class="file-info">
                    <div class="file-name">{ragFile.name}</div>
                    <div class="file-meta">
                      <span class="file-state state-{ragFile.state?.toLowerCase()}">{ragFile.state}</span>
                      {#if ragFile.sizeBytes}
                        <span class="file-size">{Math.round(parseInt(ragFile.sizeBytes) / 1024)} KB</span>
                      {/if}
                      <span class="file-date">{ragFile.createTime ? new Date(ragFile.createTime).toLocaleDateString() : ''}</span>
                    </div>
                    {#if ragFile.gcsSource}
                      <div class="file-path">📍 {ragFile.gcsSource}</div>
                    {/if}
                    {#if ragFile.problemMessage}
                      <div class="error-message">⚠️ {ragFile.problemMessage}</div>
                    {/if}
                  </div>
                  <div class="file-actions">
                    <button class="btn-small danger" on:click={() => deleteVertexFile(ragFile)}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>No files found in Vertex AI RAG corpus</p>
              <button class="btn" on:click={syncAllToVertex}>🔄 Import from Cloud Storage</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Operations Status -->
      {#if operationsStatus.size > 0}
        <div class="operations-panel">
          <h3>⚙️ Active Operations</h3>
          <div class="operations-list">
            {#each Array.from(operationsStatus.entries()) as [opId, status]}
              <div class="operation-item" class:completed={status.done}>
                <div class="operation-info">
                  <div class="operation-name">Import Operation</div>
                  <div class="operation-id">{opId}</div>
                  <div class="operation-status">
                    {status.done ? '✅ Completed' : '⏳ In Progress'}
                  </div>
                </div>
                <button class="btn-small" on:click={() => checkOperationStatus(opId)}>
                  🔄 Check Status
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>
    {/if}

    <!-- API Tester Tab -->
    {#if activeTab === 'api'}
      <div class="tab-content api-tab">
        <ApiTester />
        <EmbeddedTestRunner />
      </div>
    {/if}

    <!-- Logs Tab -->
    {#if activeTab === 'logs'}
    <section class="section">
      <h2>📜 System Console</h2>
      <p>Real-time logs showing corpus operations, uploads, and AI interactions.</p>

      <div class="log-controls">
        <button class="btn secondary" on:click={clearLogs}>
          🧹 Clear Logs
        </button>
        <span class="log-count">{consoleLogs.length} entries</span>
      </div>

      <div class="console">
        {#if consoleLogs.length > 0}
          {#each consoleLogs as log}
          <div class="log-entry {log.type}">
            <span class="log-time">{log.timestamp}</span>
            <span class="log-message">{log.message}</span>
          </div>
          {/each}
        {:else}
          <div class="log-entry info">
            <span class="log-time">{new Date().toLocaleTimeString()}</span>
            <span class="log-message">💡 Console is ready. Perform actions to see logs here.</span>
          </div>
        {/if}
      </div>
    </section>
    {/if}

    {/if}
  </main>
</div>

<!-- Document Preview Modal -->
{#if showDocumentPreview && selectedDocument}
<div
  class="modal-overlay"
  on:click={() => showDocumentPreview = false}
  on:keydown={(e) => e.key === 'Escape' && (showDocumentPreview = false)}
  role="dialog"
  aria-labelledby="preview-title"
  aria-modal="true"
  tabindex="-1"
>
  <div
    class="modal-content"
    role="document"
  >
    <div class="modal-header">
      <h3 id="preview-title">📄 Document Preview</h3>
      <button class="modal-close" on:click={() => showDocumentPreview = false} aria-label="Close preview">✕</button>
    </div>
    <div class="modal-body">
      <div class="doc-info">
        <div class="doc-detail">
          <strong>📄 File:</strong> {selectedDocument.name}
        </div>
        <div class="doc-detail">
          <strong>📏 Size:</strong> {selectedDocument.size ? `${Math.round(parseInt(selectedDocument.size) / 1024)} KB` : 'Unknown'}
        </div>
        <div class="doc-detail">
          <strong>📅 Uploaded:</strong> {selectedDocument.created ? new Date(selectedDocument.created).toLocaleDateString() : 'Unknown'}
        </div>
        <div class="doc-detail">
          <strong>📍 Path:</strong> {selectedDocument.fullPath}
        </div>
        <div class="doc-detail">
          <strong>🆔 Storage URI:</strong> {selectedDocument.fileId}
        </div>
      </div>
      <div class="preview-note">
        <p>💡 <strong>Note:</strong> Document content preview is not implemented yet. This shows metadata only.</p>
        <p>🔗 Use the storage URI above to access the file directly or implement content extraction.</p>
      </div>
    </div>
  </div>
</div>
{/if}

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
    max-width: 1400px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.12),
      0 0 0 1px rgba(255, 255, 255, 0.3);
    overflow: hidden;
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
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
    padding: 32px;
    background: white;
    border-radius: 0 0 20px 20px;
    min-height: 70vh;
  }

  .tab-nav {
    display: flex;
    gap: 8px;
    margin-bottom: 0;
    border-bottom: none;
    padding: 16px 24px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 20px 20px 0 0;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tab-nav::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    padding: 12px 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: #6c757d;
    border-radius: 12px;
    transition: all 0.3s ease;
    position: relative;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: #495057;
    background: rgba(255, 255, 255, 0.7);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .tab-btn.active {
    color: #667eea;
    background: white;
    box-shadow:
      0 4px 20px rgba(102, 126, 234, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .api-tab {
    background: none !important;
    padding: 0 !important;
    border: none !important;
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

  .info-card {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    display: flex;
    gap: 30px;
    flex-wrap: wrap;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .info-label {
    font-weight: 600;
    color: #666;
  }

  .info-value {
    font-family: monospace;
    background: #f8f9fa;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
  }

  .info-badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .info-badge.new {
    background: #d4edda;
    color: #155724;
  }

  .info-badge.existing {
    background: #cce5ff;
    color: #004085;
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

  .form-group textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s, box-shadow 0.3s;
    font-family: inherit;
    resize: vertical;
  }

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
    margin-right: 10px;
    margin-bottom: 10px;
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
    background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  }

  .btn.danger {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
    margin: 2px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-small:hover {
    background: #5a6fd8;
  }

  .btn-small.danger {
    background: #dc3545;
  }

  .btn-small.danger:hover {
    background: #c82333;
  }

  .file-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
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
    flex-shrink: 0;
  }

  .file-info {
    flex: 1;
    min-width: 0;
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
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .file-size,
  .file-date {
    font-size: 12px;
    color: #666;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .file-path {
    font-size: 11px;
    color: #888;
    font-family: monospace;
    background: #f8f9fa;
    padding: 2px 6px;
    border-radius: 3px;
    word-break: break-all;
  }

  .file-actions {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex-shrink: 0;
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
  .upload-zone.drag-over,
  .upload-zone:focus {
    border-color: #667eea;
    background: #f8f9ff;
    outline: none;
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

  .upload-actions {
    margin-top: 20px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .message {
    margin-top: 20px;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid;
  }

  .message.success {
    background: #d4edda;
    border-left-color: #28a745;
    color: #155724;
  }

  .message.error {
    background: #f8d7da;
    border-left-color: #dc3545;
    color: #721c24;
  }

  .ai-response {
    margin-top: 20px;
    padding: 20px;
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    border-left: 4px solid #667eea;
  }

  .ai-response h4 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-weight: 600;
  }

  .response-content {
    white-space: pre-wrap;
    line-height: 1.6;
    color: #444;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 20px 0;
    color: #666;
    padding: 20px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e1e5e9;
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

  .corpus-controls {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;
    align-items: center;
    flex-wrap: wrap;
  }

  .corpus-highlight {
    margin-bottom: 30px;
  }

  .corpus-highlight h3 {
    color: #2c3e50;
    margin-bottom: 15px;
    font-size: 1.2rem;
  }

  .corpus-section h3 {
    color: #2c3e50;
    margin-bottom: 20px;
    font-size: 1.2rem;
  }

  .corpus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 15px;
  }

  .corpus-card {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
  }

  .corpus-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .corpus-card.current-user {
    border-color: #667eea;
    background: #f8f9ff;
  }

  .corpus-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .corpus-title {
    font-weight: 600;
    color: #2c3e50;
    font-size: 16px;
  }

  .user-badge {
    background: #667eea;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
  }

  .corpus-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .corpus-id,
  .corpus-user,
  .corpus-created {
    font-size: 13px;
    color: #666;
    font-family: monospace;
  }

  .status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.new {
    background: #d4edda;
    color: #155724;
  }

  .status-badge.existing {
    background: #cce5ff;
    color: #004085;
  }

  .log-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .log-count {
    font-size: 14px;
    color: #666;
    font-weight: 600;
  }

  .console {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 20px;
    max-height: 500px;
    overflow-y: auto;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }

  .log-entry {
    padding: 8px 0;
    border-bottom: 1px solid #333;
    display: flex;
    gap: 15px;
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    color: #888;
    font-weight: 600;
    min-width: 80px;
    flex-shrink: 0;
  }

  .log-message {
    flex: 1;
  }

  .log-entry.info .log-message {
    color: #e0e0e0;
  }

  .log-entry.success .log-message {
    color: #4CAF50;
  }

  .log-entry.error .log-message {
    color: #f44336;
  }

  .log-entry.warning .log-message {
    color: #ff9800;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #666;
    background: white;
    border-radius: 8px;
    border: 1px solid #e1e5e9;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #e1e5e9;
  }

  .modal-header h3 {
    margin: 0;
    color: #2c3e50;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #666;
    padding: 5px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .modal-close:hover {
    background: #f8f9fa;
  }

  .modal-body {
    padding: 25px;
  }

  .doc-info {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .doc-detail {
    margin-bottom: 10px;
    font-size: 14px;
  }

  .doc-detail strong {
    color: #2c3e50;
    margin-right: 8px;
  }

  .preview-note {
    background: #e3f2fd;
    border: 1px solid #bbdefb;
    border-radius: 8px;
    padding: 15px;
  }

  .preview-note p {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #1976d2;
  }

  .preview-note p:last-child {
    margin-bottom: 0;
  }

  /* File Manager Styles */
  .file-manager-controls {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;
    align-items: center;
    flex-wrap: wrap;
  }

  .file-manager-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
  }

  .file-panel {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    overflow: hidden;
  }

  .panel-header {
    background: #f8f9fa;
    padding: 15px 20px;
    border-bottom: 1px solid #e1e5e9;
  }

  .panel-header h3 {
    margin: 0 0 8px 0;
    color: #2c3e50;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .breadcrumb {
    font-size: 12px;
    color: #666;
    font-family: monospace;
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #e1e5e9;
  }

  .bucket-name {
    color: #2c3e50;
    font-weight: 600;
  }

  .path-separator {
    color: #999;
    margin: 0 4px;
  }

  .current-path {
    color: #667eea;
  }

  .corpus-info {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
  }

  .corpus-id {
    font-family: monospace;
    background: white;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid #e1e5e9;
  }

  .file-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.2s;
  }

  .file-item:hover {
    background: #f8f9fa;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-item.folder {
    color: #667eea;
    font-weight: 500;
  }

  .file-item.vertex-file.error {
    background: #fff5f5;
    border-left: 3px solid #dc3545;
  }

  .file-item .file-icon {
    margin-right: 12px;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .file-item .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-item .file-name {
    font-weight: 500;
    color: #2c3e50;
    margin-bottom: 4px;
    word-break: break-word;
  }

  .file-item .file-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .file-item .file-size,
  .file-item .file-date {
    font-size: 11px;
    color: #666;
    background: #f0f0f0;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .file-state {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .file-state.state-active {
    background: #d4edda;
    color: #155724;
  }

  .file-state.state-error {
    background: #f8d7da;
    color: #721c24;
  }

  .file-state.state-pending {
    background: #fff3cd;
    color: #856404;
  }

  .file-item .file-path {
    font-size: 10px;
    color: #888;
    font-family: monospace;
    background: #f8f9fa;
    padding: 1px 4px;
    border-radius: 2px;
    word-break: break-all;
    margin-bottom: 4px;
  }

  .error-message {
    font-size: 11px;
    color: #dc3545;
    background: #f8d7da;
    padding: 4px 6px;
    border-radius: 3px;
    margin-top: 4px;
  }

  .file-item .file-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .operations-panel {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .operations-panel h3 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .operations-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .operation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 15px;
    background: #f8f9fa;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .operation-item.completed {
    background: #d4edda;
    border-color: #c3e6cb;
  }

  .operation-info {
    flex: 1;
    min-width: 0;
  }

  .operation-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 2px;
  }

  .operation-id {
    font-size: 11px;
    color: #666;
    font-family: monospace;
    background: white;
    padding: 1px 4px;
    border-radius: 2px;
    margin-bottom: 2px;
    word-break: break-all;
  }

  .operation-status {
    font-size: 12px;
    font-weight: 500;
  }

  .operation-item:not(.completed) .operation-status {
    color: #856404;
  }

  .operation-item.completed .operation-status {
    color: #155724;
  }

  @media (max-width: 768px) {
    .tab-nav {
      flex-wrap: wrap;
    }

    .tab-btn {
      padding: 12px 20px;
      font-size: 14px;
    }

    .info-card {
      flex-direction: column;
      gap: 15px;
    }

    .corpus-grid {
      grid-template-columns: 1fr;
    }

    .file-card {
      flex-direction: column;
      text-align: center;
    }

    .file-actions {
      flex-direction: row;
      justify-content: center;
    }

    .file-manager-grid {
      grid-template-columns: 1fr;
    }

    .file-manager-controls {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>