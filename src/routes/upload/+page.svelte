<script lang="ts">
  import NewspaperLayout from '$lib/components/NewspaperLayout.svelte';
  import FileUpload from '$lib/components/FileUpload.svelte';
  import { onMount } from 'svelte';

  let uploadStats = {
    totalFiles: 0,
    totalSize: '0KB',
    successfulUploads: 0,
    failedUploads: 0
  };

  let recentUploads: Array<{
    name: string;
    size: string;
    time: string;
    status: 'success' | 'pending' | 'error';
  }> = [];

  let isUploading = false;
  let uploadMessage = '';

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + sizes[i];
  }

  function handleUploadProgress(event: CustomEvent) {
    isUploading = true;
    uploadMessage = event.detail.message || 'Processing upload...';
  }

  function handleUploadComplete(event: CustomEvent) {
    isUploading = false;
    const fileInfo = event.detail;

    // Add to recent uploads
    recentUploads = [{
      name: fileInfo.name || 'Unknown file',
      size: fileInfo.size ? formatFileSize(fileInfo.size) : 'Unknown',
      time: new Date().toLocaleTimeString(),
      status: 'success'
    }, ...recentUploads].slice(0, 10);

    // Update stats
    uploadStats.totalFiles++;
    uploadStats.successfulUploads++;
    updateTotalSize();

    uploadMessage = 'Upload completed successfully!';

    // Clear message after 3 seconds
    setTimeout(() => {
      uploadMessage = '';
    }, 3000);
  }

  function handleUploadError(event: CustomEvent) {
    isUploading = false;
    uploadStats.failedUploads++;
    uploadMessage = `Upload failed: ${event.detail.error}`;

    // Clear message after 5 seconds
    setTimeout(() => {
      uploadMessage = '';
    }, 5000);
  }

  function updateTotalSize() {
    // Calculate total size from recent uploads (approximate)
    let totalBytes = 0;
    recentUploads.forEach(upload => {
      const sizeStr = upload.size;
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
    uploadStats.totalSize = formatFileSize(totalBytes);
  }

  onMount(() => {
    // Add some mock recent uploads for demonstration
    recentUploads = [
      {
        name: 'welcome_guide.pdf',
        size: '125KB',
        time: '10:30 AM',
        status: 'success'
      },
      {
        name: 'system_overview.docx',
        size: '87KB',
        time: '10:15 AM',
        status: 'success'
      }
    ];
    updateTotalSize();
  });
</script>

<NewspaperLayout sectionName="Document Upload Bureau">
  <section class="upload-section">
    <div class="section-header">
      <h1>📤 Document Upload Central</h1>
      <div class="section-subtitle">File Processing & Document Management Division</div>
      <div class="section-date">{new Date().toLocaleDateString()}</div>
    </div>

    <div class="upload-content">
      <!-- Main Upload Area -->
      <div class="upload-main">
        <h2 class="story-headline">FILE SUBMISSION DEPARTMENT NOW OPEN</h2>

        <div class="upload-story">
          <p class="lead-paragraph">
            The RAG Herald's Document Upload Bureau is operating at full capacity, accepting submissions
            of all major file formats. Our advanced processing systems ensure immediate integration
            into our searchable document corpus.
          </p>

          <div class="upload-component">
            <FileUpload
              on:uploadProgress={handleUploadProgress}
              on:uploadComplete={handleUploadComplete}
              on:uploadError={handleUploadError}
            />
          </div>

          {#if uploadMessage}
            <div class="upload-message" class:uploading={isUploading} class:success={!isUploading && !uploadMessage.includes('failed')} class:error={uploadMessage.includes('failed')}>
              {uploadMessage}
            </div>
          {/if}

          <div class="accepted-formats">
            <h3>📋 Accepted Document Types</h3>
            <div class="format-grid">
              <div class="format-item">
                <span class="format-icon">📄</span>
                <span class="format-name">PDF Documents</span>
              </div>
              <div class="format-item">
                <span class="format-icon">📝</span>
                <span class="format-name">Word Documents</span>
              </div>
              <div class="format-item">
                <span class="format-icon">📊</span>
                <span class="format-name">Spreadsheets</span>
              </div>
              <div class="format-item">
                <span class="format-icon">📋</span>
                <span class="format-name">Text Files</span>
              </div>
              <div class="format-item">
                <span class="format-icon">🖼️</span>
                <span class="format-name">Images</span>
              </div>
              <div class="format-item">
                <span class="format-icon">📑</span>
                <span class="format-name">Presentations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Statistics Sidebar -->
      <div class="upload-sidebar">
        <div class="stats-box">
          <h3>📊 Upload Statistics</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-number">{uploadStats.totalFiles}</span>
              <span class="stat-label">Files Processed</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{uploadStats.totalSize}</span>
              <span class="stat-label">Total Size</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{uploadStats.successfulUploads}</span>
              <span class="stat-label">Successful</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{uploadStats.failedUploads}</span>
              <span class="stat-label">Failed</span>
            </div>
          </div>
        </div>

        <div class="recent-uploads-box">
          <h3>📰 Recent Submissions</h3>
          <div class="uploads-list">
            {#each recentUploads as upload}
              <div class="upload-item">
                <div class="upload-info">
                  <span class="upload-name">📄 {upload.name}</span>
                  <span class="upload-details">{upload.size} • {upload.time}</span>
                </div>
                <span class="upload-status status-{upload.status}">
                  {upload.status === 'success' ? '✅' : upload.status === 'pending' ? '⏳' : '❌'}
                </span>
              </div>
            {/each}
            {#if recentUploads.length === 0}
              <div class="no-uploads">No recent uploads to report</div>
            {/if}
          </div>
        </div>

        <div class="system-status-box">
          <h3>⚙️ System Status</h3>
          <div class="status-items">
            <div class="status-item">
              <span class="status-dot operational"></span>
              <span>Upload Service: Online</span>
            </div>
            <div class="status-item">
              <span class="status-dot operational"></span>
              <span>File Processing: Active</span>
            </div>
            <div class="status-item">
              <span class="status-dot operational"></span>
              <span>Storage: Available</span>
            </div>
            <div class="status-item">
              <span class="status-dot operational"></span>
              <span>AI Integration: Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Processing Instructions -->
    <div class="processing-instructions">
      <h3>📜 Document Processing Guidelines</h3>
      <div class="instruction-columns">
        <div class="instruction-column">
          <h4>Step 1: File Selection</h4>
          <ul>
            <li>Drag files directly to the upload zone</li>
            <li>Or click to browse your computer</li>
            <li>Multiple files can be selected</li>
            <li>Maximum file size: 50MB each</li>
          </ul>
        </div>
        <div class="instruction-column">
          <h4>Step 2: Processing</h4>
          <ul>
            <li>Files are automatically scanned</li>
            <li>Text content is extracted</li>
            <li>Documents are indexed for search</li>
            <li>AI analysis is performed</li>
          </ul>
        </div>
        <div class="instruction-column">
          <h4>Step 3: Integration</h4>
          <ul>
            <li>Files join the searchable corpus</li>
            <li>Available immediately for queries</li>
            <li>Backed up to cloud storage</li>
            <li>Full-text search enabled</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</NewspaperLayout>

<style>
  .upload-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    border: 3px solid #000;
    background: #f0f8ff;
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

  .upload-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
    margin-bottom: 30px;
  }

  .upload-main {
    border: 2px solid #000;
    padding: 25px;
    background: #fff;
  }

  .story-headline {
    font-family: 'Times New Roman', serif;
    font-size: 28px;
    font-weight: bold;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 3px solid #000;
  }

  .lead-paragraph {
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.6;
    margin: 0 0 25px 0;
    text-align: justify;
  }

  .upload-component {
    margin: 25px 0;
    padding: 20px;
    border: 2px dashed #000;
    background: #f9f9f9;
  }

  .upload-message {
    margin: 15px 0;
    padding: 15px;
    border: 2px solid #000;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    text-align: center;
  }

  .upload-message.uploading {
    background: #fff3cd;
    border-color: #ffc107;
    color: #856404;
  }

  .upload-message.success {
    background: #d4edda;
    border-color: #28a745;
    color: #155724;
  }

  .upload-message.error {
    background: #f8d7da;
    border-color: #dc3545;
    color: #721c24;
  }

  .accepted-formats {
    margin-top: 30px;
    padding: 20px;
    border: 2px solid #000;
    background: #f5f5f5;
  }

  .accepted-formats h3 {
    font-family: 'Times New Roman', serif;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .format-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
  }

  .format-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border: 1px solid #000;
    background: #fff;
    font-family: 'Times New Roman', serif;
  }

  .format-icon {
    font-size: 18px;
  }

  .format-name {
    font-weight: bold;
  }

  .upload-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .stats-box, .recent-uploads-box, .system-status-box {
    border: 2px solid #000;
    padding: 20px;
    background: #f5f5f5;
  }

  .stats-box h3, .recent-uploads-box h3, .system-status-box h3 {
    margin: 0 0 15px 0;
    font-family: 'Times New Roman', serif;
    border-bottom: 2px solid #000;
    padding-bottom: 5px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .stat-item {
    text-align: center;
    border: 1px solid #000;
    padding: 10px;
    background: #fff;
  }

  .stat-number {
    display: block;
    font-weight: bold;
    font-size: 20px;
    font-family: 'Times New Roman', serif;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    font-family: 'Times New Roman', serif;
  }

  .uploads-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .upload-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #ccc;
    font-family: 'Times New Roman', serif;
  }

  .upload-info {
    display: flex;
    flex-direction: column;
  }

  .upload-name {
    font-weight: bold;
    font-size: 14px;
  }

  .upload-details {
    font-size: 12px;
    color: #666;
  }

  .upload-status {
    font-size: 18px;
  }

  .status-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Times New Roman', serif;
    font-size: 14px;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #28a745;
    border: 1px solid #000;
  }

  .status-dot.operational {
    background: #28a745;
  }

  .processing-instructions {
    border: 2px solid #000;
    padding: 25px;
    background: #f9f9f9;
  }

  .processing-instructions h3 {
    font-family: 'Times New Roman', serif;
    font-size: 24px;
    margin: 0 0 20px 0;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }

  .instruction-columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 30px;
  }

  .instruction-column h4 {
    font-family: 'Times New Roman', serif;
    font-size: 16px;
    margin: 0 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 5px;
  }

  .instruction-column ul {
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    padding-left: 20px;
    margin: 0;
  }

  .instruction-column li {
    margin: 5px 0;
  }

  @media (max-width: 768px) {
    .upload-content {
      grid-template-columns: 1fr;
    }

    .instruction-columns {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .format-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>