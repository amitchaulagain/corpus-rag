<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { sessionToken } from '$lib/store';

  let isAuthenticated = false;
  let user: any = null;
  let currentTheme = 'corporate';
  let isSidebarCollapsed = false;

  onMount(async () => {
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('user');

    // Update the sessionToken store
    if (storedToken) {
      sessionToken.set(storedToken);
    }

    if (!storedToken || !storedUser) {
      // No stored credentials, redirect to login
      goto('/');
      return;
    }

    try {
      // Validate session with server
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        }
      });

      if (!response.ok) {
        // Session invalid or expired
        console.error('Session validation failed');
        logout();
        return;
      }

      const data = await response.json();

      if (!data.success || !data.user) {
        console.error('Invalid session response');
        logout();
        return;
      }

      // Check if user is admin
      if (data.user.userType !== 'admin') {
        console.error('Access denied: User is not an admin');
        alert('Access Denied: This application is only for administrators.');
        logout();
        return;
      }

      // Session is valid and user is admin
      user = data.user;
      isAuthenticated = true;

      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(data.user));

      // Set up periodic session validation (every 5 minutes)
      const intervalId = setInterval(async () => {
        try {
          const token = localStorage.getItem('session_token');
          if (!token) {
            clearInterval(intervalId);
            logout();
            return;
          }

          const verifyResponse = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!verifyResponse.ok) {
            clearInterval(intervalId);
            alert('Your session has expired. Please log in again.');
            logout();
          }
        } catch (error) {
          console.error('Periodic session check failed:', error);
          clearInterval(intervalId);
          logout();
        }
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      console.error('Session validation error:', error);
      logout();
      return;
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'corporate';
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
  });

  function logout() {
    sessionToken.set(null);
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
            <button class="btn btn-ghost btn-circle avatar">
              <div class="w-8 rounded-full">
                <img src={user.picture} alt={user.name} />
              </div>
            </button>
            <ul class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
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
          <li class="w-full">
            <a href="/job-analytics" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath.includes('job-analytics')} title={isSidebarCollapsed ? 'Job Analytics' : ''}>
              <span class="text-xl">📈</span>
              {#if !isSidebarCollapsed}<span>Job Analytics</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/admin" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/admin'} title={isSidebarCollapsed ? 'Admin' : ''}>
              <span class="text-xl">🛠️</span>
              {#if !isSidebarCollapsed}<span>Admin Panel</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/admin/rbac" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/admin/rbac'} title={isSidebarCollapsed ? 'RBAC' : ''}>
              <span class="text-xl">🔐</span>
              {#if !isSidebarCollapsed}<span>RBAC Management</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/admin/audit-logs" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/admin/audit-logs'} title={isSidebarCollapsed ? 'Audit Logs' : ''}>
              <span class="text-xl">📋</span>
              {#if !isSidebarCollapsed}<span>Audit Logs</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/admin/analytics" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/admin/analytics'} title={isSidebarCollapsed ? 'Analytics' : ''}>
              <span class="text-xl">📊</span>
              {#if !isSidebarCollapsed}<span>Analytics</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/admin/orders" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/admin/orders'} title={isSidebarCollapsed ? 'Orders' : ''}>
              <span class="text-xl">📦</span>
              {#if !isSidebarCollapsed}<span>Orders</span>{/if}
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
          <li class="w-full">
            <a href="/generic-questions" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/generic-questions'} title={isSidebarCollapsed ? 'Generic Questions' : ''}>
              <span class="text-xl">📝</span>
              {#if !isSidebarCollapsed}<span>Generic Questions</span>{/if}
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

          <!-- Agent Section -->
          {#if !isSidebarCollapsed}
            <li class="menu-title">
              <span class="text-xs text-base-content/60">Agent</span>
            </li>
          {/if}
          <li class="w-full">
            <a href="/agents/register" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/agents/register'} title={isSidebarCollapsed ? 'Register Agent' : ''}>
              <span class="text-xl">🤝</span>
              {#if !isSidebarCollapsed}<span>Register Agent</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/agents/dashboard" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/agents/dashboard'} title={isSidebarCollapsed ? 'Agent Dashboard' : ''}>
              <span class="text-xl">📊</span>
              {#if !isSidebarCollapsed}<span>Agent Dashboard</span>{/if}
            </a>
          </li>

          <!-- Divider -->
          {#if !isSidebarCollapsed}
            <li><hr class="my-2" /></li>
          {/if}

          <!-- Help & Settings -->
          <li class="w-full">
            <a href="/ollama" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/ollama'} title={isSidebarCollapsed ? 'Ollama' : ''}>
              <span class="text-xl">🦙</span>
              {#if !isSidebarCollapsed}<span>Ollama</span>{/if}
            </a>
          </li>
          <li class="w-full">
            <a href="/api-docs" class="flex items-center gap-3 w-full {isSidebarCollapsed ? 'justify-center' : ''}" class:active={currentPath === '/api-docs'} title={isSidebarCollapsed ? 'API Docs' : ''}>
              <span class="text-xl">📖</span>
              {#if !isSidebarCollapsed}<span>API Docs</span>{/if}
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

