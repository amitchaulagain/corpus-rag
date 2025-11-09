<script lang="ts">
  import { onMount } from 'svelte';

  let user: any = null;
  let userId: string = '';
  let selectedFile: File | null = null;
  let uploadedFiles: any[] = [];
  let uploading = false;
  let message = '';

  onMount(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      user = JSON.parse(storedUser);
      userId = user.email;
      console.log('✓ User loaded:', userId);
      loadFiles();
    } else {
      console.warn('⚠️ No user found in localStorage');
      message = '⚠️ Please log in first';
    }
  });

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      selectedFile = input.files[0];
    }
  }

  async function uploadFile() {
    if (!selectedFile || !userId) {
      message = '⚠️ Please log in first';
      return;
    }

    uploading = true;
    message = '';

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('userId', userId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        message = `✅ Uploaded: ${data.filename}`;
        selectedFile = null;
        await loadFiles();
      } else {
        message = `❌ Error: ${data.error}`;
      }
    } catch (error: any) {
      message = `❌ Upload failed: ${error.message}`;
    } finally {
      uploading = false;
    }
  }

  async function loadFiles() {
    if (!userId) return;

    try {
      const response = await fetch(`/api/upload?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.success) {
        uploadedFiles = data.files || [];
        console.log('✓ Files loaded:', uploadedFiles.length);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }

  async function deleteFile(filename: string) {
    if (!userId) return;

    try {
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, filename })
      });

      if (response.ok) {
        await loadFiles();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <h1 class="text-4xl font-bold mb-8">📄 Files</h1>

  <!-- Debug Info -->
  <div class="alert alert-info mb-6">
    <div class="text-sm font-mono">
      <strong>Debug:</strong> User: {userId || 'Not logged in'} | Files: {uploadedFiles.length}
    </div>
  </div>

  <!-- Upload Section -->
  <div class="card bg-base-100 shadow-xl mb-8">
    <div class="card-body">
      <h2 class="card-title">Upload Resume File</h2>

      <input
        type="file"
        accept=".txt,.pdf"
        on:change={handleFileSelect}
        class="file-input file-input-bordered w-full max-w-xs"
      />

      {#if selectedFile}
        <p class="text-sm mt-2">Selected: {selectedFile.name}</p>
      {/if}

      <button
        class="btn btn-primary mt-4"
        on:click={uploadFile}
        disabled={!selectedFile || uploading}
      >
        {#if uploading}
          <span class="loading loading-spinner"></span>
          Uploading...
        {:else}
          Upload
        {/if}
      </button>

      {#if message}
        <div class="alert {message.startsWith('✅') ? 'alert-success' : 'alert-error'} mt-4">
          {message}
        </div>
      {/if}
    </div>
  </div>

  <!-- Uploaded Files -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Your Files</h2>

      {#if uploadedFiles.length === 0}
        <p class="text-base-content/70">No files uploaded yet.</p>
      {:else}
        <div class="space-y-2">
          {#each uploadedFiles as file}
            <div class="flex items-center justify-between p-3 bg-base-200 rounded">
              <div class="flex items-center gap-3">
                <span class="text-2xl">{file.type === 'pdf' ? '📕' : '📄'}</span>
                <div>
                  <span class="font-medium">{file.name}</span>
                  <span class="ml-2 text-xs badge badge-primary">{file.type.toUpperCase()}</span>
                </div>
              </div>
              <button class="btn btn-error btn-sm" on:click={() => deleteFile(file.name)}>
                Delete
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Link to Search -->
  <div class="mt-8 text-center">
    <a href="/search-simple" class="btn btn-lg btn-primary">
      Go to AI Comparison →
    </a>
  </div>
</main>
