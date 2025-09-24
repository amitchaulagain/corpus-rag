<script lang="ts">
  import NewspaperLayout from '$lib/components/NewspaperLayout.svelte';
  import { onMount } from 'svelte';

  let activeView = 'cloud'; // 'cloud', 'vertex', 'local'
  let cloudFiles: any[] = [];
  let vertexFiles: any[] = [];
  let isLoading = false;
  let selectedFiles: Set<string> = new Set();
  let fileStats = {
    totalFiles: 0,
    totalSize: '0MB',
    syncedFiles: 0,
    pendingFiles: 0
  };

  let isAuthenticated = false;
  let accessToken = '';

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + sizes[i];
  }

  function setActiveView(view: string) {
    activeView = view;
    loadFiles();
  }

  async function loadFiles() {
    if (!isAuthenticated) return;

    isLoading = true;
    try {
      if (activeView === 'cloud') {
        await loadCloudFiles();
      } else if (activeView === 'vertex') {
        await loadVertexFiles();
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadCloudFiles() {
    // Mock cloud files for demonstration
    cloudFiles = [
      {
        name: 'project_proposal.pdf',
        size: '2.4MB',
        modified: '2024-01-15',
        status: 'synced',
        type: 'pdf',
        path: '/documents/proposals/'
      },
      {
        name: 'meeting_notes_jan.docx',
        size: '456KB',
        modified: '2024-01-14',
        status: 'synced',
        type: 'docx',
        path: '/documents/meetings/'
      },
      {
        name: 'budget_analysis.xlsx',
        size: '1.2MB',
        modified: '2024-01-13',
        status: 'pending',
        type: 'xlsx',
        path: '/documents/finance/'
      },
      {
        name: 'company_overview.pptx',
        size: '5.8MB',
        modified: '2024-01-12',
        status: 'synced',
        type: 'pptx',
        path: '/documents/presentations/'
      }
    ];
    updateFileStats();
  }

  async function loadVertexFiles() {
    // Mock vertex files
    vertexFiles = [
      {
        name: 'indexed_proposal.pdf',
        size: '2.4MB',
        indexed: '2024-01-15',
        status: 'indexed',
        chunks: 15,
        confidence: '94%'
      },
      {
        name: 'processed_notes.docx',
        size: '456KB',
        indexed: '2024-01-14',
        status: 'indexed',
        chunks: 8,
        confidence: '97%'
      }
    ];
  }

  function updateFileStats() {
    fileStats.totalFiles = cloudFiles.length;
    fileStats.syncedFiles = cloudFiles.filter(f => f.status === 'synced').length;
    fileStats.pendingFiles = cloudFiles.filter(f => f.status === 'pending').length;

    // Calculate total size (mock)
    let totalBytes = 0;
    cloudFiles.forEach(file => {
      const sizeStr = file.size;
      const match = sizeStr.match(/(\d+(?:\.\d+)?)(KB|MB|GB)/);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        switch (unit) {
          case 'GB': totalBytes += value * 1024 * 1024 * 1024; break;
          case 'MB': totalBytes += value * 1024 * 1024; break;
          case 'KB': totalBytes += value * 1024; break;
        }
      }
    });
    fileStats.totalSize = formatFileSize(totalBytes);
  }

  function toggleFileSelection(fileName: string) {
    if (selectedFiles.has(fileName)) {
      selectedFiles.delete(fileName);
    } else {
      selectedFiles.add(fileName);
    }
    selectedFiles = new Set(selectedFiles); // Trigger reactivity
  }

  function selectAllFiles() {
    const currentFiles = activeView === 'cloud' ? cloudFiles : vertexFiles;
    if (selectedFiles.size === currentFiles.length) {
      selectedFiles.clear();
    } else {
      currentFiles.forEach(file => selectedFiles.add(file.name));
    }
    selectedFiles = new Set(selectedFiles);
  }

  async function performBulkAction(action: string) {
    const selectedArray = Array.from(selectedFiles);
    if (selectedArray.length === 0) return;

    console.log(`Performing ${action} on:`, selectedArray);

    // Mock actions
    switch (action) {
      case 'sync':
        console.log('Syncing selected files...');
        break;
      case 'delete':
        console.log('Deleting selected files...');
        break;
      case 'download':
        console.log('Downloading selected files...');
        break;
    }

    selectedFiles.clear();
    selectedFiles = new Set(selectedFiles);
  }

  function getFileIcon(type: string): string {
    switch (type) {
      case 'pdf': return '📄';
      case 'docx': case 'doc': return '📝';
      case 'xlsx': case 'xls': return '📊';
      case 'pptx': case 'ppt': return '📋';
      case 'txt': return '📃';
      default: return '📁';
    }
  }

  onMount(() => {
    // Check authentication status (mock for now)
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      isAuthenticated = true;
      accessToken = stored;
      loadFiles();
    } else {
      // Load mock data even without auth for demo
      loadFiles();
    }
  });
</script>

<NewspaperLayout sectionName="File Archive Department">
  <section class="files-section">
    <div class="section-header">
      <h1>🗄️ Document Archive & Management</h1>
      <div class="section-subtitle">File Organization & Storage Division</div>
      <div class="section-date">{new Date().toLocaleDateString()}</div>
    </div>

    <div class="files-content">
      <!-- File Browser Controls -->
      <div class="browser-controls">
        <h2 class="controls-headline">📂 ARCHIVE BROWSER OPERATIONAL</h2>

        <div class="view-selector">
          <h3>📊 Storage Location</h3>
          <div class="view-buttons">
            <button
              class="view-btn"
              class:active={activeView === 'cloud'}
              on:click={() => setActiveView('cloud')}
            >
              ☁️ Cloud Storage
            </button>
            <button
              class="view-btn"
              class:active={activeView === 'vertex'}
              on:click={() => setActiveView('vertex')}
            >
              🧠 Vertex AI Index
            </button>
            <button
              class="view-btn"
              class:active={activeView === 'local'}
              on:click={() => setActiveView('local')}
            >
              💾 Local Files
            </button>
          </div>
        </div>

        <!-- File Statistics -->
        <div class="file-statistics">
          <h3>📈 Archive Statistics</h3>
          <div class="stats-grid">
            <div class="stat-box">
              <span class="stat-number">{fileStats.totalFiles}</span>
              <span class="stat-label">Total Files</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{fileStats.totalSize}</span>
              <span class="stat-label">Storage Used</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{fileStats.syncedFiles}</span>
              <span class="stat-label">Synced</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{fileStats.pendingFiles}</span>
              <span class="stat-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <!-- File Browser -->
      <div class="file-browser">
        <div class="browser-header">
          <div class="browser-title">
            <h3>
              {activeView === 'cloud' ? '☁️ Cloud Storage Files' :
               activeView === 'vertex' ? '🧠 Vertex AI Indexed Files' :
               '💾 Local Files'}
            </h3>
            <span class="file-count">
              {activeView === 'cloud' ? cloudFiles.length :
               activeView === 'vertex' ? vertexFiles.length : 0} files
            </span>
          </div>

          <div class="bulk-actions">
            <button class="action-btn" on:click={selectAllFiles}>
              {selectedFiles.size > 0 ? '❌ Clear Selection' : '☑️ Select All'}
            </button>
            {#if selectedFiles.size > 0}
              <button class="action-btn sync" on:click={() => performBulkAction('sync')}>
                🔄 Sync ({selectedFiles.size})
              </button>
              <button class="action-btn download" on:click={() => performBulkAction('download')}>
                📥 Download ({selectedFiles.size})
              </button>
              <button class="action-btn delete" on:click={() => performBulkAction('delete')}>
                🗑️ Delete ({selectedFiles.size})
              </button>
            {/if}
          </div>
        </div>

        <div class="file-table">
          <div class="table-header">
            <span class="col-select">☑️</span>
            <span class="col-name">Document Name</span>
            <span class="col-size">Size</span>
            <span class="col-date">
              {activeView === 'vertex' ? 'Indexed' : 'Modified'}
            </span>
            <span class="col-status">Status</span>
            <span class="col-actions">Actions</span>
          </div>

          {#if isLoading}
            <div class="loading-state">
              <p>📡 Loading archive data...</p>
            </div>
          {:else}
            {#each (activeView === 'cloud' ? cloudFiles : activeView === 'vertex' ? vertexFiles : []) as file}
              <div class="file-row" class:selected={selectedFiles.has(file.name)}>
                <span class="col-select">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.name)}
                    on:change={() => toggleFileSelection(file.name)}
                  />
                </span>
                <span class="col-name">
                  <span class="file-icon">{getFileIcon(file.type || '')}</span>
                  <span class="file-name">{file.name}</span>
                </span>
                <span class="col-size">{file.size}</span>
                <span class="col-date">
                  {activeView === 'vertex' ? file.indexed : file.modified}
                </span>
                <span class="col-status">
                  <span class="status-badge status-{file.status}">
                    {activeView === 'vertex' ?
                      `${file.confidence} (${file.chunks} chunks)` :
                      file.status}
                  </span>
                </span>
                <span class="col-actions">
                  <button class="mini-btn" title="Preview">👁️</button>
                  <button class="mini-btn" title="Download">📥</button>
                  {#if file.status === 'pending'}
                    <button class="mini-btn" title="Sync">🔄</button>
                  {/if}
                  <button class="mini-btn" title="Delete">🗑️</button>
                </span>
              </div>
            {/each}

            {#if (activeView === 'cloud' ? cloudFiles : activeView === 'vertex' ? vertexFiles : []).length === 0}
              <div class="no-files">
                <h4>📰 No Files Found</h4>
                <p>
                  {#if activeView === 'cloud'}
                    No files currently stored in cloud storage.
                  {:else if activeView === 'vertex'}
                    No files have been indexed by Vertex AI yet.
                  {:else}
                    No local files available.
                  {/if}
                </p>
                <p>Upload some documents to get started!</p>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>

    <!-- File Management Tools -->
    <div class="management-tools">
      <h3>🔧 Archive Management Tools</h3>
      <div class="tools-grid">
        <div class="tool-section">
          <h4>🔄 Synchronization</h4>
          <p>Keep all your documents in sync across storage systems.</p>
          <div class="tool-actions">
            <button class="tool-btn">🔄 Sync All Files</button>
            <button class="tool-btn">📊 View Sync Status</button>
            <button class="tool-btn">⚙️ Sync Settings</button>
          </div>
        </div>
        <div class="tool-section">
          <h4>🧹 Cleanup & Organization</h4>
          <p>Maintain a clean and organized document archive.</p>
          <div class="tool-actions">
            <button class="tool-btn">🧹 Remove Duplicates</button>
            <button class="tool-btn">📁 Organize Folders</button>
            <button class="tool-btn">🗑️ Clear Trash</button>
          </div>
        </div>
        <div class="tool-section">
          <h4>📈 Analytics & Reports</h4>
          <p>Get insights into your document collection.</p>
          <div class="tool-actions">
            <button class="tool-btn">📊 Usage Report</button>
            <button class="tool-btn">📈 Storage Analysis</button>
            <button class="tool-btn">🔍 File Audit</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</NewspaperLayout>

<style>
  .files-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 3px solid #000;
    background: #fff8dc;
  }

  .section-header h1 {
    font-family: 'Times New Roman', serif;
    font-size: 36px;
    margin: 0 0 10px 0;
    font-weight: bold;
  }

  .section-subtitle {
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    font-style: italic;
    margin-bottom: 10px;
  }

  .section-date {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    color: #666;
  }

  .files-content {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 30px;
    margin-bottom: 30px;
  }

  .browser-controls {
    border: 2px solid #000;
    padding: 25px;
    background: #f5f5f5;
  }

  .controls-headline {
    font-family: 'Times New Roman', serif;
    font-size: 24px;
    font-weight: bold;
    margin: 0 0 25px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #000;
  }

  .view-selector {
    margin-bottom: 30px;
  }

  .view-selector h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .view-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .view-btn {
    padding: 12px 15px;
    border: 2px solid #000;
    background: #fff;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .view-btn:hover {
    background: #e0e0e0;
  }

  .view-btn.active {
    background: #000;
    color: #fff;
  }

  .file-statistics h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .stat-box {
    text-align: center;
    border: 2px solid #000;
    padding: 15px;
    background: #fff;
  }

  .stat-number {
    display: block;
    font-weight: bold;
    font-size: 18px;
    font-family: 'Times New Roman', serif;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    font-family: 'Times New Roman', serif;
    margin-top: 5px;
  }

  .file-browser {
    border: 2px solid #000;
    background: #fff;
  }

  .browser-header {
    padding: 20px;
    border-bottom: 2px solid #000;
    background: #f9f9f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
  }

  .browser-title h3 {
    font-family: 'Times New Roman', serif;
    margin: 0;
    font-size: 20px;
  }

  .file-count {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    color: #666;
    margin-left: 10px;
  }

  .bulk-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 8px 12px;
    border: 2px solid #000;
    background: #fff;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }

  .action-btn:hover {
    background: #e0e0e0;
  }

  .action-btn.sync { background: #e8f5e8; }
  .action-btn.download { background: #e8e8ff; }
  .action-btn.delete { background: #ffe8e8; }

  .file-table {
    max-height: 500px;
    overflow-y: auto;
  }

  .table-header, .file-row {
    display: grid;
    grid-template-columns: 50px 2fr 100px 120px 150px 120px;
    gap: 10px;
    padding: 15px 20px;
    font-family: 'Times New Roman', serif;
    align-items: center;
  }

  .table-header {
    background: #f0f0f0;
    border-bottom: 2px solid #000;
    font-weight: bold;
    position: sticky;
    top: 0;
  }

  .file-row {
    border-bottom: 1px solid #ddd;
    transition: background 0.2s;
  }

  .file-row:hover {
    background: #f9f9f9;
  }

  .file-row.selected {
    background: #e8f5e8;
  }

  .col-select {
    text-align: center;
  }

  .col-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-icon {
    font-size: 18px;
  }

  .file-name {
    font-weight: bold;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
  }

  .status-synced {
    background: #90ee90;
    color: #006400;
  }

  .status-pending {
    background: #ffeb3b;
    color: #f57c00;
  }

  .status-indexed {
    background: #87ceeb;
    color: #000080;
  }

  .mini-btn {
    background: none;
    border: 1px solid #000;
    padding: 4px 6px;
    margin: 0 2px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  }

  .mini-btn:hover {
    background: #e0e0e0;
  }

  .loading-state, .no-files {
    text-align: center;
    padding: 40px;
    font-family: 'Times New Roman', serif;
  }

  .no-files h4 {
    margin: 0 0 15px 0;
    font-size: 20px;
  }

  .management-tools {
    border: 2px solid #000;
    padding: 25px;
    background: #f9f9f9;
  }

  .management-tools h3 {
    font-family: 'Times New Roman', serif;
    font-size: 24px;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }

  .tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
  }

  .tool-section {
    padding: 20px;
    border: 2px solid #000;
    background: #fff;
  }

  .tool-section h4 {
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .tool-section p {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.4;
    margin: 10px 0 15px 0;
  }

  .tool-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tool-btn {
    padding: 8px 12px;
    border: 2px solid #000;
    background: #fff;
    font-family: 'Times New Roman', serif;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }

  .tool-btn:hover {
    background: #e0e0e0;
  }

  @media (max-width: 768px) {
    .files-content {
      grid-template-columns: 1fr;
    }

    .tools-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .browser-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .bulk-actions {
      width: 100%;
    }

    .table-header, .file-row {
      grid-template-columns: 40px 1fr 80px 100px;
    }

    .col-status, .col-actions {
      display: none;
    }
  }
</style>