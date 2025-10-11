<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let isAuthenticated = false;
  let user: any = null;
  let currentTheme = 'corporate';
  let isSidebarCollapsed = false;

  onMount(() => {
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      isAuthenticated = true;
      user = JSON.parse(storedUser);
    } else {
      goto('/');
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'corporate';
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
  });

  function logout() {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
  }

  function goToWelcome() {
    goto('/');
  }

  $: currentPath = $page.url.pathname;
</script>

{#if isAuthenticated && user}
  <div class="drawer lg:drawer-open">
    <input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

    <!-- Page content -->
    <div class="drawer-content flex flex-col">
      <!-- Navbar -->
      <div class="navbar bg-base-100 border-b border-base-200 lg:hidden">
        <div class="flex-none">
          <label for="drawer-toggle" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </label>
        </div>
        <div class="flex-1">
          <button class="text-xl font-bold hover:text-primary transition-colors" on:click={goToWelcome}>🚀 RAG System</button>
        </div>
        <div class="flex-none flex items-center gap-2">
          <button class="btn btn-ghost btn-circle" on:click={toggleTheme} title="Toggle theme">
            {#if currentTheme === 'light'}
              🌙
            {:else}
              ☀️
            {/if}
          </button>
          <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-ghost btn-circle avatar">
              <div class="w-8 rounded-full">
                <img src={user.picture} alt={user.name} />
              </div>
            </label>
            <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li><span class="font-medium">{user.name}</span></li>
              <li><span class="text-sm opacity-70">{user.email}</span></li>
              <li><hr class="my-2" /></li>
              <li><button on:click={logout}>🚪 Sign Out</button></li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <main class="flex-1">
        <slot />
      </main>
    </div>

    <!-- Sidebar -->
    <div class="drawer-side">
      <label for="drawer-toggle" class="drawer-overlay"></label>
      <aside class="min-h-full bg-base-200 transition-all duration-300" class:w-64={!isSidebarCollapsed} class:w-20={isSidebarCollapsed}>
        <!-- Logo & Collapse Button -->
        <div class="p-4 border-b border-base-300 flex items-center justify-between">
          {#if !isSidebarCollapsed}
            <button class="text-2xl font-bold hover:text-primary transition-colors" on:click={goToWelcome}>🚀 RAG System</button>
          {/if}
          <button
            class="btn btn-ghost btn-sm flex items-center justify-center"
            class:btn-circle={isSidebarCollapsed}
            class:w-full={isSidebarCollapsed}
            on:click={() => isSidebarCollapsed = !isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span class="text-xl">
              {#if isSidebarCollapsed}
                ▶
              {:else}
                ◀
              {/if}
            </span>
          </button>
        </div>

        <!-- Navigation Menu -->
        <ul class="menu p-4 space-y-2 w-full">
          <!-- Admin Section -->
          {#if !isSidebarCollapsed}
            <li class="menu-title">
              <span class="text-xs text-base-content/60">Admin</span>
            </li>
          {/if}
          <li class="w-full">
            <a href="/dashboard" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/dashboard'} title={isSidebarCollapsed ? 'Dashboard' : ''}>
              <span class="text-xl">📊</span>
              {#if !isSidebarCollapsed}<span>Dashboard</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/users" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/users'} title={isSidebarCollapsed ? 'Users' : ''}>
              <span class="text-xl">👥</span>
              {#if !isSidebarCollapsed}<span>Users</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/jobs" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/jobs'} title={isSidebarCollapsed ? 'Job Tracking' : ''}>
              <span class="text-xl">💼</span>
              {#if !isSidebarCollapsed}<span>Job Tracking</span>{/if}
            </a>
          </li>

          <!-- Divider -->
          {#if !isSidebarCollapsed}
            <li><hr class="my-2" /></li>
          {/if}

          <!-- Tools Section -->
          {#if !isSidebarCollapsed}
            <li class="menu-title">
              <span class="text-xs text-base-content/60">Tools</span>
            </li>
          {/if}
          <li class="w-full">
            <a href="/upload" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/upload'} title={isSidebarCollapsed ? 'Files' : ''}>
              <span class="text-xl">🗄️</span>
              {#if !isSidebarCollapsed}<span>Files</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/search" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/search'} title={isSidebarCollapsed ? 'Search' : ''}>
              <span class="text-xl">🔍</span>
              {#if !isSidebarCollapsed}<span>Search</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/cover-letters" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/cover-letters'} title={isSidebarCollapsed ? 'Cover Letters' : ''}>
              <span class="text-xl">✍️</span>
              {#if !isSidebarCollapsed}<span>Cover Letters</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/employer-questions" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/employer-questions'} title={isSidebarCollapsed ? 'Q&A' : ''}>
              <span class="text-xl">❓</span>
              {#if !isSidebarCollapsed}<span>Q&A</span>{/if}
            </a>
          </li>

          <!-- Divider -->
          {#if !isSidebarCollapsed}
            <li><hr class="my-2" /></li>
          {/if}

          <!-- New Resume Analysis Section -->
          {#if !isSidebarCollapsed}
            <li class="menu-title">
              <span class="text-xs text-base-content/60">Resume Analysis</span>
            </li>
          {/if}
          <li class="w-full">
            <a href="/job-analysis" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/job-analysis'} title={isSidebarCollapsed ? 'Job Analysis' : ''}>
              <span class="text-xl">🎯</span>
              {#if !isSidebarCollapsed}<span>Job Analysis</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/resume-enhancement" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/resume-enhancement'} title={isSidebarCollapsed ? 'Resume Enhancement' : ''}>
              <span class="text-xl">✨</span>
              {#if !isSidebarCollapsed}<span>Resume Enhancement</span>{/if}
            </a>
          </li>

          <!-- Divider -->
          {#if !isSidebarCollapsed}
            <li><hr class="my-2" /></li>
          {/if}

          <!-- Help & Settings -->
          <li class="w-full">
            <a href="/help" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/help'} title={isSidebarCollapsed ? 'Help' : ''}>
              <span class="text-xl">📚</span>
              {#if !isSidebarCollapsed}<span>Help</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/settings" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/settings'} title={isSidebarCollapsed ? 'Settings' : ''}>
              <span class="text-xl">⚙️</span>
              {#if !isSidebarCollapsed}<span>Settings</span>{/if}
            </a>
          </li>
        </ul>

        <!-- User info (desktop only) -->
        <div class="hidden lg:block absolute bottom-0 w-full p-4 border-t border-base-300">
          {#if !isSidebarCollapsed}
            <div class="flex items-center gap-3 mb-3">
              <div class="avatar">
                <div class="w-10 rounded-full">
                  <img src={user.picture} alt={user.name} />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate text-base-content">{user.name}</div>
                <div class="text-sm opacity-70 truncate text-base-content">{user.email}</div>
              </div>
              <button class="btn btn-ghost btn-circle btn-sm" on:click={toggleTheme} title="Toggle theme">
                {#if currentTheme === 'light'}
                  🌙
                {:else}
                  ☀️
                {/if}
              </button>
            </div>
            <button class="btn btn-outline btn-sm w-full" on:click={logout}>
              🚪 Sign Out
            </button>
          {:else}
            <div class="flex flex-col items-center gap-2">
              <div class="avatar">
                <div class="w-10 rounded-full">
                  <img src={user.picture} alt={user.name} />
                </div>
              </div>
              <button class="btn btn-ghost btn-circle btn-sm" on:click={toggleTheme} title="Toggle theme">
                {#if currentTheme === 'light'}
                  🌙
                {:else}
                  ☀️
                {/if}
              </button>
              <button class="btn btn-ghost btn-circle btn-sm" on:click={logout} title="Sign Out">
                🚪
              </button>
            </div>
          {/if}
        </div>
      </aside>
    </div>
  </div>
{:else}
  <!-- Loading screen -->
  <div class="min-h-screen bg-base-100 flex items-center justify-center">
    <div class="text-center">
      <div class="loading loading-spinner loading-lg mb-4"></div>
      <h2 class="text-2xl font-bold mb-2 text-base-content">🔐 Checking Authentication...</h2>
      <p class="opacity-70 text-base-content">Please wait while we verify your login status</p>
    </div>
  </div>
{/if}

