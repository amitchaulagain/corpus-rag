<!-- RBAC Management Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getJwtToken, getAuthHeaders } from '$lib/auth-helper.js';

  let currentUser: any = null;
  let activeTab = 'roles'; // 'roles', 'departments', 'assignments'
  
  // Roles data
  let roles: any[] = [];
  let isLoadingRoles = false;
  
  // Departments data
  let departments: any[] = [];
  let isLoadingDepartments = false;
  
  // Users with roles
  let users: any[] = [];
  let isLoadingUsers = false;
  let selectedUser: any = null;
  let showRoleModal = false;
  let availableRoles: any[] = [];
  let availableDepartments: any[] = [];

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      if (currentUser.userType !== 'admin') {
        alert('Access denied - Admin only');
        window.location.href = '/';
        return;
      }
    } else {
      alert('Please log in');
      window.location.href = '/';
      return;
    }

    // Verify we can get JWT token
    try {
      await getJwtToken();
    } catch (error: any) {
      alert('Failed to authenticate: ' + error.message);
      window.location.href = '/';
      return;
    }

    await Promise.all([loadRoles(), loadDepartments(), loadUsers()]);
  });

  async function loadRoles() {
    isLoadingRoles = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/roles', {
        headers
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          roles = data.roles;
          availableRoles = data.roles;
        }
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      isLoadingRoles = false;
    }
  }

  async function loadDepartments() {
    isLoadingDepartments = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/departments', {
        headers
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          departments = data.departments;
          availableDepartments = data.departments;
        }
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      isLoadingDepartments = false;
    }
  }

  async function loadUsers() {
    isLoadingUsers = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/users', {
        headers
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          users = data.users;
        }
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      isLoadingUsers = false;
    }
  }

  function openRoleModal(user: any) {
    selectedUser = user;
    showRoleModal = true;
  }

  async function assignRole(): Promise<void> {
    if (!selectedUser || !selectedRole || !selectedUser.id) return;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/users/${selectedUser.id}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: selectedRole,
          departmentId: selectedDepartment || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Role assigned successfully!');
          showRoleModal = false;
          await loadUsers();
        } else {
          alert('Failed: ' + (data.error || 'Unknown error'));
        }
      } else {
        const data = await response.json();
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to assign role:', error);
      alert('Error: ' + (error?.message || 'Unknown error'));
    }
  }

  async function removeRole(userId: string, role: string, departmentId?: string): Promise<void> {
    if (!confirm(`Remove role "${role}" from this user?`)) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ role, departmentId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Role removed successfully!');
          await loadUsers();
        }
      }
    } catch (error: any) {
      console.error('Failed to remove role:', error);
      alert('Error: ' + (error?.message || 'Unknown error'));
    }
  }

  let selectedRole = '';
  let selectedDepartment = '';
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">🔐 RBAC Management</h1>
      <p class="text-base-content/70">Manage roles, departments, and user assignments</p>
    </div>
    <div class="flex gap-2">
      <a href="/admin" class="btn btn-ghost">← Back to Admin</a>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs tabs-boxed mb-6">
    <button 
      class="tab {activeTab === 'roles' ? 'tab-active' : ''}" 
      on:click={() => activeTab = 'roles'}
    >
      📋 Roles ({roles.length})
    </button>
    <button 
      class="tab {activeTab === 'departments' ? 'tab-active' : ''}" 
      on:click={() => activeTab = 'departments'}
    >
      🏢 Departments ({departments.length})
    </button>
    <button 
      class="tab {activeTab === 'assignments' ? 'tab-active' : ''}" 
      on:click={() => activeTab = 'assignments'}
    >
      👥 User Assignments ({users.length})
    </button>
  </div>

  <!-- Roles Tab -->
  {#if activeTab === 'roles'}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">System Roles</h2>
        {#if isLoadingRoles}
          <div class="flex justify-center">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Display Name</th>
                  <th>Permissions</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {#each roles as role}
                  <tr>
                    <td><code class="badge badge-primary">{role.name}</code></td>
                    <td>{role.displayName}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        {#each role.permissions.slice(0, 3) as perm}
                          <span class="badge badge-outline">
                            {perm.resource}:{perm.action}
                          </span>
                        {/each}
                        {#if role.permissions.length > 3}
                          <span class="badge badge-ghost">+{role.permissions.length - 3} more</span>
                        {/if}
                      </div>
                    </td>
                    <td>
                      {#if role.isSystemRole}
                        <span class="badge badge-success">System</span>
                      {:else}
                        <span class="badge badge-info">Custom</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Departments Tab -->
  {#if activeTab === 'departments'}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">Departments</h2>
        {#if isLoadingDepartments}
          <div class="flex justify-center">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Parent</th>
                </tr>
              </thead>
              <tbody>
                {#each departments as dept}
                  <tr>
                    <td><code class="badge">{dept.code}</code></td>
                    <td>{dept.name}</td>
                    <td>
                      {#if dept.isActive}
                        <span class="badge badge-success">Active</span>
                      {:else}
                        <span class="badge badge-error">Inactive</span>
                      {/if}
                    </td>
                    <td>{dept.parentDepartmentId ? 'Has Parent' : 'Root'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- User Assignments Tab -->
  {#if activeTab === 'assignments'}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">User Role Assignments</h2>
        {#if isLoadingUsers}
          <div class="flex justify-center">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Departments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each users as user}
                  <tr>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        {#each user.roles || [] as role}
                          <span class="badge badge-primary">{role}</span>
                        {/each}
                        {#if !user.roles || user.roles.length === 0}
                          <span class="text-base-content/50">No roles</span>
                        {/if}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-outline">{user.departments || 0} dept(s)</span>
                    </td>
                    <td>
                      <button 
                        class="btn btn-sm btn-primary"
                        on:click={() => openRoleModal(user)}
                      >
                        Assign Role
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Role Assignment Modal -->
  {#if showRoleModal && selectedUser}
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Assign Role to {selectedUser.email}</h3>
        
        <div class="form-control mb-4">
          <label class="label" for="role-select">
            <span class="label-text">Role</span>
          </label>
          <select 
            id="role-select"
            class="select select-bordered w-full"
            bind:value={selectedRole}
          >
            <option value="">Select a role</option>
            {#each availableRoles as role}
              <option value={role.name}>{role.displayName}</option>
            {/each}
          </select>
        </div>

        <div class="form-control mb-4">
          <label class="label" for="dept-select">
            <span class="label-text">Department (Optional)</span>
          </label>
          <select 
            id="dept-select"
            class="select select-bordered w-full"
            bind:value={selectedDepartment}
          >
            <option value="">No department (system-wide)</option>
            {#each availableDepartments as dept}
              <option value={dept.id}>{dept.name} ({dept.code})</option>
            {/each}
          </select>
        </div>

        <div class="modal-action">
          <button class="btn" on:click={() => showRoleModal = false}>Cancel</button>
          <button 
            class="btn btn-primary" 
            on:click={assignRole}
            disabled={!selectedRole}
          >
            Assign Role
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
