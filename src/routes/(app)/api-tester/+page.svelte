<script lang="ts">
  import ApiKeyGenerator from '$lib/components/ApiKeyGenerator.svelte';
</script>

<svelte:head>
  <title>API Tester</title>
</svelte:head>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-6">API Key Generator</h1>
  <p class="mb-8 text-base-content/70">Use this tool to generate API keys for testing and external application access.</p>
  
  <div class="max-w-4xl">
    <ApiKeyGenerator userId="test-user" />
  </div>
</div>
