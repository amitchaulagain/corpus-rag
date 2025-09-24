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
  <link rel="stylesheet" href="/newspaper.css">
</svelte:head>

<div class="newspaper">
  <!-- Masthead -->
  <header class="masthead">
    <div class="weather">
      <div class="weather-temp">{weatherTemp}°F</div>
      <div class="weather-desc">{weatherDesc}</div>
    </div>
    <div class="title-section">
      <h1>The RAG Herald</h1>
      <div class="subtitle">{sectionName}</div>
      <div class="date">{getCurrentDate()}</div>
    </div>
    <div class="stock-ticker">
      <div class="ticker-item">DOCS: +{stockValues.DOCS.toFixed(1)}%</div>
      <div class="ticker-item">AI: +{stockValues.AI.toFixed(1)}%</div>
      <div class="ticker-item">RAG: +{stockValues.RAG.toFixed(1)}%</div>
    </div>
  </header>

  <!-- Breaking News Banner -->
  <div class="breaking-news">
    <span class="breaking-label">BREAKING:</span>
    <span class="breaking-text">{breakingNews}</span>
  </div>

  <!-- Navigation -->
  <nav class="newspaper-nav">
    <div class="nav-header">
      <h3>📰 Section Navigation</h3>
    </div>
    <div class="nav-items">
      {#each navigationItems as item}
        <a
          href={item.path}
          class="nav-item"
          class:active={$page.url.pathname === item.path}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Main Content -->
  <div class="main-content">
    <slot />
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-section">
        <h4>About The RAG Herald</h4>
        <p>Your trusted source for document intelligence and AI-powered search capabilities since 2024.</p>
      </div>
      <div class="footer-section">
        <h4>Current Section</h4>
        <p><strong>{sectionName}</strong></p>
        <p>Navigate using the section links above to access different newspaper departments.</p>
      </div>
      <div class="footer-section">
        <h4>System Status</h4>
        <div class="status-indicator">
          <span class="status-dot operational"></span>
          <span>All Systems Operational</span>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2024 The RAG Herald. All rights reserved. | Powered by AI Document Intelligence</p>
    </div>
  </footer>
</div>

<style>
  .newspaper-nav {
    background: #f5f5f5;
    border: 2px solid #000;
    border-left: 8px solid #000;
    margin: 0 0 20px 0;
    padding: 15px;
  }

  .nav-header {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #000;
  }

  .nav-header h3 {
    margin: 0;
    font-family: 'Times New Roman', serif;
    font-size: 18px;
    font-weight: bold;
  }

  .nav-items {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 15px;
    border: 2px solid #000;
    background: #fff;
    color: #000;
    text-decoration: none;
    font-family: 'Times New Roman', serif;
    font-weight: bold;
    transition: all 0.2s ease;
  }

  .nav-item:hover {
    background: #e0e0e0;
    box-shadow: 2px 2px 0 #000;
  }

  .nav-item.active {
    background: #000;
    color: #fff;
  }

  .nav-icon {
    font-size: 16px;
  }

  .nav-label {
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .nav-items {
      flex-direction: column;
    }

    .nav-item {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>