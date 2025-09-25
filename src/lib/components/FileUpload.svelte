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

<div class="card bg-base-100 shadow-xl max-w-2xl mx-auto">
  <div class="card-body">
    <div class="text-center mb-6">
      <h3 class="card-title text-2xl justify-center mb-2">📁 Upload Files</h3>
      <p class="text-base-content/70">Upload files to your personal RAG storage</p>
    </div>

    <div class="form-control w-full mb-4">
      <label class="label" for="userId">
        <span class="label-text font-semibold">User ID:</span>
      </label>
      <input
        type="text"
        id="userId"
        class="input input-bordered w-full"
        class:input-disabled={uploading}
        bind:value={userId}
        placeholder="Enter your user ID"
        disabled={uploading}
      />
    </div>

    <div class="form-control w-full mb-4">
      <label class="label" for="fileInput">
        <span class="label-text font-semibold">Select Files:</span>
      </label>
      <input
        type="file"
        id="fileInput"
        class="file-input file-input-bordered w-full"
        class:file-input-disabled={uploading}
        {accept}
        {multiple}
        onchange={handleFileSelect}
        disabled={uploading}
      />

      {#if maxSize}
        <div class="label">
          <span class="label-text-alt">Max file size: {formatFileSize(maxSize)}</span>
        </div>
      {/if}
    </div>

    {#if files && files.length > 0}
      <div class="card bg-base-200 mb-4">
        <div class="card-body p-4">
          <h4 class="font-semibold mb-3">Selected Files:</h4>
          <div class="space-y-2">
            {#each Array.from(files) as file}
              <div class="flex justify-between items-center p-2 bg-base-100 rounded">
                <span class="font-medium text-sm">{file.name}</span>
                <span class="text-xs opacity-70">({formatFileSize(file.size)})</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <button
      type="button"
      class="btn btn-primary btn-block mb-4"
      class:btn-disabled={uploading || !files || files.length === 0 || !userId.trim()}
      class:loading={uploading}
      onclick={handleUpload}
      disabled={uploading || !files || files.length === 0 || !userId.trim()}
    >
      {uploading ? 'Uploading...' : 'Upload Files'}
    </button>

    {#if uploading && uploadProgress > 0}
      <div class="flex items-center gap-3 mb-4">
        <progress class="progress progress-primary flex-1" value={uploadProgress} max="100"></progress>
        <span class="text-sm font-semibold">{uploadProgress}%</span>
      </div>
    {/if}

    {#if error}
      <div class="alert alert-error mb-4">
        <span>❌ {error}</span>
      </div>
    {/if}

    {#if success}
      <div class="alert alert-success">
        <span>✅ {success}</span>
      </div>
    {/if}
  </div>
</div>

