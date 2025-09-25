<script lang="ts">
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api-client.js';

  let isAuthenticated = false;
  let user: any = null;
  let cloudFiles: any[] = [];
  let ragFiles: any[] = [];
  let isLoading = false;
  let corpusId: string = '';
  let previewFile: any = null;
  let previewContent: string = '';
  let originalContent: string = '';
  let showPreview = false;
  let isEditing = false;
  let isSaving = false;

  onMount(() => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;
      loadFiles();
      loadCorpusInfo();
    }
  });

  async function loadFiles() {
    if (!user) return;

    isLoading = true;
    try {
      const response = await apiRequest(`/api/files?userId=${user.email}`);
      const data = await response.json();

      if (data.success) {
        cloudFiles = data.data.files || [];
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadCorpusInfo() {
    if (!user) return;

    try {
      // First get corpus info
      const corpusResponse = await apiRequest(`/api/corpus?userId=${user.email}`);
      const corpusData = await corpusResponse.json();

      if (corpusData.success && corpusData.data.corpusId) {
        corpusId = corpusData.data.corpusId;
        await loadRagFiles();
      }
    } catch (error) {
      console.error('Failed to load corpus info:', error);
    }
  }

  async function loadRagFiles() {
    if (!corpusId) return;

    try {
      const response = await apiRequest(`/api/vertex/files?corpusId=${corpusId}`);
      const data = await response.json();

      if (data.success) {
        ragFiles = data.files || [];
      }
    } catch (error) {
      console.error('Failed to load RAG files:', error);
    }
  }

  async function uploadFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !user) return;

    isLoading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.email);

      const response = await apiRequest('/api/files', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        await loadFiles(); // Refresh cloud files
        await loadRagFiles(); // Refresh RAG files
        input.value = ''; // Clear input
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  async function deleteFile(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;

    try {
      const response = await apiRequest(`/api/files/${filename}?userId=${user.email}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await loadFiles(); // Refresh file list
      } else {
        alert('Delete failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed: ' + error.message);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + sizes[i];
  }

  async function previewFileContent(file: any) {
    try {
      const response = await apiRequest(`/api/files/${file.name}?userId=${user.email}&preview=true`);
      const data = await response.json();

      if (data.success && data.data.preview && data.data.preview.content) {
        previewFile = file;
        previewContent = data.data.preview.content;
        originalContent = data.data.preview.content;
        showPreview = true;
        isEditing = false;
      } else {
        alert('Cannot preview this file: ' + (data.data.preview?.error || 'Unsupported file type'));
      }
    } catch (error) {
      console.error('Preview failed:', error);
      alert('Failed to load preview');
    }
  }

  function closePreview() {
    showPreview = false;
    previewFile = null;
    previewContent = '';
    originalContent = '';
    isEditing = false;
    isSaving = false;
  }

  function startEditing() {
    isEditing = true;
  }

  function cancelEditing() {
    previewContent = originalContent;
    isEditing = false;
  }

  async function saveFile() {
    if (!previewFile || isSaving) return;

    isSaving = true;
    try {
      const response = await apiRequest(`/api/files/${previewFile.name}?userId=${user.email}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: previewContent
        })
      });

      const data = await response.json();

      if (data.success) {
        originalContent = previewContent;
        isEditing = false;
        alert('File saved and synced successfully!');

        // Refresh both file lists
        await loadFiles();
        await loadRagFiles();
      } else {
        alert('Save failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed: ' + error.message);
    } finally {
      isSaving = false;
    }
  }

  function hasUnsavedChanges() {
    return previewContent !== originalContent;
  }
</script>

{#if isAuthenticated && user}
<main class="container mx-auto max-w-6xl p-6">
  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">🗄️ Files</h1>
    <p class="text-base-content/70">Upload and manage your documents</p>
  </header>

  <!-- Upload Section -->
  <div class="card bg-base-100 shadow-xl mb-8">
    <div class="card-body text-center">
      <h3 class="card-title text-xl justify-center mb-2">📤 Upload Document</h3>
      <p class="text-base-content/70 mb-6">Choose a file to upload to your document collection</p>

      <label class="btn btn-primary btn-wide" class:btn-disabled={isLoading} class:loading={isLoading}>
        {#if isLoading}
          Uploading...
        {:else}
          Choose File
        {/if}
        <input
          type="file"
          on:change={uploadFile}
          disabled={isLoading}
          accept=".pdf,.txt,.doc,.docx"
          class="hidden"
        />
      </label>
    </div>
  </div>

  <!-- Cloud Storage Files -->
  <div class="card bg-base-100 shadow-xl mb-8">
    <div class="card-body">
      <div class="flex justify-between items-center mb-6">
        <h3 class="card-title text-xl">☁️ Cloud Storage Files ({cloudFiles.length})</h3>
        <button class="btn btn-ghost btn-sm" class:btn-disabled={isLoading} on:click={loadFiles} disabled={isLoading}>
          🔄 Refresh
        </button>
      </div>

      {#if isLoading}
        <div class="flex justify-center items-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <span class="ml-4 text-base-content/70">Loading files...</span>
        </div>
      {:else if cloudFiles.length === 0}
        <div class="text-center py-16">
          <span class="text-6xl block mb-4">📄</span>
          <h4 class="text-xl font-semibold mb-2">No cloud files yet</h4>
          <p class="text-base-content/70">Upload your first document to get started</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each cloudFiles as file}
            <div class="card bg-base-200 shadow-md">
              <div class="card-body p-4">
                <div class="flex items-start gap-3">
                  <div class="text-2xl">📄</div>
                  <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-sm truncate">{file.name}</h4>
                    <p class="text-xs opacity-70">{formatFileSize(file.size)}</p>
                    <p class="text-xs opacity-70">{new Date(file.created).toLocaleDateString()}</p>
                  </div>
                  <div class="flex gap-1">
                    <button
                      class="btn btn-xs btn-primary"
                      on:click={() => previewFileContent(file)}
                      title="Preview file"
                    >
                      👁️
                    </button>
                    <button
                      class="btn btn-xs btn-error"
                      on:click={() => deleteFile(file.name)}
                      title="Delete file"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Vertex RAG Files (Minimal) -->
  <div class="alert alert-info">
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-3">
        <span class="text-xl">🤖</span>
        <span class="font-medium">RAG Corpus: {ragFiles.length} files indexed</span>
      </div>
      <button class="btn btn-ghost btn-xs" class:btn-disabled={isLoading} on:click={loadRagFiles} disabled={isLoading} title="Refresh sync status">
        🔄
      </button>
    </div>
    {#if ragFiles.length > 0}
      <div class="flex flex-wrap gap-2 mt-3">
        {#each ragFiles as file}
          <div class="badge" class:badge-success={file.state === 'ACTIVE'} class:badge-warning={file.state !== 'ACTIVE'}>
            {file.name}
            {#if file.state !== 'ACTIVE'}
              <span class="ml-1 text-xs" title="State: {file.state}">{file.state}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- File Preview Modal -->
  {#if showPreview}
    <div class="modal modal-open">
      <div class="modal-box w-11/12 max-w-5xl h-5/6 max-h-screen flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">📄 {previewFile?.name}</h3>
          <div class="flex gap-2">
            {#if !isEditing}
              <button class="btn btn-success btn-sm" on:click={startEditing}>
                ✏️ Edit
              </button>
            {:else}
              <button class="btn btn-error btn-sm" class:btn-disabled={isSaving} on:click={cancelEditing} disabled={isSaving}>
                ❌ Cancel
              </button>
              <button class="btn btn-primary btn-sm" class:btn-disabled={isSaving || !hasUnsavedChanges()} class:loading={isSaving} on:click={saveFile} disabled={isSaving || !hasUnsavedChanges()}>
                {#if isSaving}
                  Saving...
                {:else}
                  💾 Save
                {/if}
              </button>
            {/if}
            <button class="btn btn-ghost btn-sm btn-circle" on:click={closePreview}>✕</button>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          {#if isEditing}
            <textarea
              class="textarea textarea-bordered w-full h-full min-h-96 font-mono text-sm"
              bind:value={previewContent}
              placeholder="Edit your file content here..."
            ></textarea>
          {:else}
            <pre class="bg-base-200 p-4 rounded-lg overflow-auto h-full font-mono text-sm whitespace-pre-wrap">{previewContent}</pre>
          {/if}
        </div>
      </div>
      <div class="modal-backdrop" on:click={closePreview}></div>
    </div>
  {/if}
</main>
{/if}

