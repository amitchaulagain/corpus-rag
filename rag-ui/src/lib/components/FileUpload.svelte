<!-- FileUpload.svelte - Svelte 5 file upload component -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    userId: string;
    accept?: string;
    multiple?: boolean;
    maxSize?: number; // in bytes
  }

  let { userId, accept = "*/*", multiple = false, maxSize = 10 * 1024 * 1024 }: Props = $props();

  let uploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state('');
  let success = $state('');
  let files = $state<FileList | null>(null);

  const dispatch = createEventDispatcher<{
    upload: { success: boolean; files?: any[]; error?: string };
  }>();

  async function handleUpload() {
    if (!files || files.length === 0) {
      error = 'Please select files to upload';
      return;
    }

    if (!userId.trim()) {
      error = 'User ID is required';
      return;
    }

    uploading = true;
    error = '';
    success = '';
    uploadProgress = 0;

    try {
      const uploadedFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file size
        if (maxSize && file.size > maxSize) {
          error = `File "${file.name}" is too large. Max size: ${formatFileSize(maxSize)}`;
          uploading = false;
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userId);

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        uploadedFiles.push(result.file);
        uploadProgress = Math.round(((i + 1) / files.length) * 100);
      }

      success = `Successfully uploaded ${uploadedFiles.length} file(s)`;
      files = null; // Reset file input

      dispatch('upload', { success: true, files: uploadedFiles });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
      dispatch('upload', { success: false, error });
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    files = input.files;
    error = '';
    success = '';
  }
</script>

<div class="upload-container">
  <div class="upload-header">
    <h3>📁 Upload Files</h3>
    <p>Upload files to your personal RAG storage</p>
  </div>

  <div class="upload-form">
    <div class="form-group">
      <label for="userId">User ID:</label>
      <input
        type="text"
        id="userId"
        bind:value={userId}
        placeholder="Enter your user ID"
        disabled={uploading}
      />
    </div>

    <div class="form-group">
      <label for="fileInput">Select Files:</label>
      <input
        type="file"
        id="fileInput"
        {accept}
        {multiple}
        onchange={handleFileSelect}
        disabled={uploading}
      />

      {#if maxSize}
        <div class="help-text">Max file size: {formatFileSize(maxSize)}</div>
      {/if}
    </div>

    {#if files && files.length > 0}
      <div class="selected-files">
        <h4>Selected Files:</h4>
        {#each Array.from(files) as file}
          <div class="file-item">
            <span class="file-name">{file.name}</span>
            <span class="file-size">({formatFileSize(file.size)})</span>
          </div>
        {/each}
      </div>
    {/if}

    <button
      type="button"
      class="upload-btn"
      onclick={handleUpload}
      disabled={uploading || !files || files.length === 0 || !userId.trim()}
    >
      {uploading ? 'Uploading...' : 'Upload Files'}
    </button>

    {#if uploading && uploadProgress > 0}
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {uploadProgress}%"></div>
        </div>
        <span class="progress-text">{uploadProgress}%</span>
      </div>
    {/if}

    {#if error}
      <div class="message error">
        ❌ {error}
      </div>
    {/if}

    {#if success}
      <div class="message success">
        ✅ {success}
      </div>
    {/if}
  </div>
</div>

<style>
  .upload-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    background: #f8f9fa;
  }

  .upload-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .upload-header h3 {
    margin-bottom: 5px;
    color: #2c3e50;
  }

  .upload-header p {
    color: #666;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #555;
  }

  .form-group input {
    width: 100%;
    padding: 8px 12px;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .form-group input:focus {
    outline: none;
    border-color: #667eea;
  }

  .form-group input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .help-text {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
  }

  .selected-files {
    margin: 15px 0;
    padding: 10px;
    background: white;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  .selected-files h4 {
    margin-bottom: 10px;
    color: #2c3e50;
    font-size: 14px;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 1px solid #eee;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-name {
    font-weight: 500;
    color: #333;
  }

  .file-size {
    font-size: 12px;
    color: #666;
  }

  .upload-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .upload-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .progress-container {
    margin-top: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: #666;
  }

  .message {
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
  }

  .message.success {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
  }

  .message.error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
  }
</style>