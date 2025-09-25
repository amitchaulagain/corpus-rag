<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';

  export let pageTitle = 'The RAG Herald';
  export let sectionName = 'Main Edition';

  // Weather and dynamic content
  let weatherTemp = 72;
  let weatherDesc = 'Partly Cloudy';
  let breakingNews = 'All systems operational - newspaper sections now available';
  let stockValues = { DOCS: 2.3, AI: 5.7, RAG: 12.1 };
  let breakingNewsIndex = 0;

  // Breaking news messages
  const breakingNewsMessages = [
    'All systems operational - newspaper sections now available',
    'Navigate between sections using the page navigation below',
    'Authentication, upload, search, and file management now separated',
    'Each section provides focused newspaper-style interface'
  ];

  // Helper functions
  function getCurrentDate() {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  }

  // Navigation items
  const navigationItems = [
    { path: '/', label: 'Front Page', icon: '🏠' },
    { path: '/auth', label: 'Authentication', icon: '🔐' },
    { path: '/upload', label: 'Document Upload', icon: '📤' },
    { path: '/search', label: 'Search Desk', icon: '🔍' },
    { path: '/files', label: 'File Archives', icon: '🗄️' }
  ];

  onMount(() => {
    // Breaking news rotation
    const newsInterval = setInterval(() => {
      breakingNewsIndex = (breakingNewsIndex + 1) % breakingNewsMessages.length;
      breakingNews = breakingNewsMessages[breakingNewsIndex];
    }, 8000);

    // Stock ticker updates
    const stockInterval = setInterval(() => {
      stockValues.DOCS += (Math.random() - 0.5) * 2;
      stockValues.AI += (Math.random() - 0.5) * 2;
      stockValues.RAG += (Math.random() - 0.5) * 2;

      // Keep values positive
      stockValues.DOCS = Math.max(0, stockValues.DOCS);
      stockValues.AI = Math.max(0, stockValues.AI);
      stockValues.RAG = Math.max(0, stockValues.RAG);
    }, 5000);

    // Weather updates
    const weatherInterval = setInterval(() => {
      const temps = [70, 72, 74, 71, 73];
      const descs = ['Partly Cloudy', 'Sunny', 'Cloudy', 'Clear Skies', 'Light Breeze'];
      weatherTemp = temps[Math.floor(Math.random() * temps.length)];
      weatherDesc = descs[Math.floor(Math.random() * descs.length)];
    }, 15000);

    return () => {
      clearInterval(newsInterval);
      clearInterval(stockInterval);
      clearInterval(weatherInterval);
    };
  });
</script>

<svelte:head>
  <title>{pageTitle} - {sectionName}</title>
</svelte:head>

<div class="min-h-screen bg-base-200">
  <!-- Masthead -->
  <header class="bg-primary text-primary-content p-6">
    <div class="container mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
      <div class="text-center">
        <div class="text-2xl font-bold">{weatherTemp}°F</div>
        <div class="text-sm italic">{weatherDesc}</div>
      </div>
      <div class="text-center">
        <h1 class="text-4xl lg:text-6xl font-bold tracking-widest">The RAG Herald</h1>
        <div class="text-lg italic">{sectionName}</div>
        <div class="text-sm border-t border-b border-primary-content/50 py-2 mt-2">{getCurrentDate()}</div>
      </div>
      <div class="flex flex-col gap-2">
        <div class="badge badge-accent">DOCS: +{stockValues.DOCS.toFixed(1)}%</div>
        <div class="badge badge-accent">AI: +{stockValues.AI.toFixed(1)}%</div>
        <div class="badge badge-accent">RAG: +{stockValues.RAG.toFixed(1)}%</div>
      </div>
    </div>
  </header>

  <!-- Breaking News Banner -->
  <div class="bg-error text-error-content p-4 text-center animate-pulse">
    <span class="badge badge-error-content bg-error-content text-error font-bold mr-2">BREAKING:</span>
    <span class="font-semibold">{breakingNews}</span>
  </div>

  <!-- Navigation -->
  <nav class="bg-base-100 border-2 border-primary border-l-8 m-4 p-4">
    <div class="mb-4 pb-2 border-b-2 border-primary">
      <h3 class="text-lg font-bold">📰 Section Navigation</h3>
    </div>
    <div class="flex flex-wrap gap-4">
      {#each navigationItems as item}
        <a
          href={item.path}
          class="btn btn-outline btn-primary"
          class:btn-primary={$page.url.pathname === item.path}
          class:btn-outline={$page.url.pathname !== item.path}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Main Content -->
  <div class="container mx-auto p-6">
    <slot />
  </div>

  <!-- Footer -->
  <footer class="footer bg-primary text-primary-content p-10">
    <div class="footer-content grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <h4 class="text-lg font-bold mb-4 border-b border-primary-content/50 pb-2">About The RAG Herald</h4>
        <p class="text-sm">Your trusted source for document intelligence and AI-powered search capabilities since 2024.</p>
      </div>
      <div>
        <h4 class="text-lg font-bold mb-4 border-b border-primary-content/50 pb-2">Current Section</h4>
        <p class="font-bold">{sectionName}</p>
        <p class="text-sm">Navigate using the section links above to access different newspaper departments.</p>
      </div>
      <div>
        <h4 class="text-lg font-bold mb-4 border-b border-primary-content/50 pb-2">System Status</h4>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-success rounded-full"></div>
          <span class="text-sm">All Systems Operational</span>
        </div>
      </div>
    </div>
    <div class="border-t border-primary-content/50 pt-4 mt-8 text-center">
      <p class="text-xs opacity-75">&copy; 2024 The RAG Herald. All rights reserved. | Powered by AI Document Intelligence</p>
    </div>
  </footer>
</div>

