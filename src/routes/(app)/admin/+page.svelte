<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let users: any[] = [];
  let isLoading = true;
  let currentUser: any = null;
  let selectedUser: any = null;
  let showEditModal = false;

  onMount(async () => {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      currentUser = JSON.parse(storedUser);

      // Check if user is admin
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

    await loadUsers();
  });

  async function loadUsers() {
    isLoading = true;
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
      } else {
        alert('Failed to load users');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Failed to load users: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  function editUser(user) {
    selectedUser = { ...user };
    showEditModal = true;
  }

  async function saveUser() {
    if (!selectedUser) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          userType: selectedUser.userType,
          isPaid: selectedUser.isPaid,
          apiPermissions: selectedUser.apiPermissions
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('User updated successfully');
          showEditModal = false;
          await loadUsers();
        }
      } else {
        alert('Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update user: ' + error.message);
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        alert('User deleted successfully');
        await loadUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user: ' + error.message);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">🛠️ Admin Dashboard</h1>
      <p class="text-base-content/70">Manage users and permissions</p>
    </div>
    <div class="flex gap-2">
      <a href="/admin/rbac" class="btn btn-primary">🔐 RBAC Management</a>
      <a href="/admin/audit-logs" class="btn btn-primary">📋 Audit Logs</a>
      <a href="/admin/analytics" class="btn btn-primary">📊 Analytics</a>
      <a href="/admin/orders" class="btn btn-secondary">📦 Manage Orders</a>
      <a href="/" class="btn btn-ghost">← Back to Home</a>
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">👥 Users ({users.length})</h2>

        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Type</th>
                <th>Paid</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                <tr>
                  <td class="font-mono text-sm">{user.email}</td>
                  <td>{user.name}</td>
                  <td>
                    <span class="badge {user.userType === 'admin' ? 'badge-error' : user.userType === 'premium' ? 'badge-warning' : 'badge-info'}">
                      {user.userType}
                    </span>
                  </td>
                  <td>
                    <span class="badge {user.isPaid ? 'badge-success' : 'badge-ghost'}">
                      {user.isPaid ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td class="text-sm">{formatDate(user.createdAt)}</td>
                  <td class="text-sm">{formatDate(user.lastLogin)}</td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-sm btn-primary" on:click={() => editUser(user)}>
                        ✏️ Edit
                      </button>
                      <button class="btn btn-sm btn-error" on:click={() => deleteUser(user.id)}>
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit User Modal -->
  {#if showEditModal && selectedUser}
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Edit User: {selectedUser.email}</h3>

        <div class="form-control gap-4">
          <!-- User Type -->
          <div>
            <label class="label">
              <span class="label-text">User Type</span>
            </label>
            <select class="select select-bordered w-full" bind:value={selectedUser.userType}>
              <option value="freetier">Free Tier</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <!-- Payment Status -->
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" class="checkbox checkbox-primary" bind:checked={selectedUser.isPaid} />
              <span class="label-text">Paid Account</span>
            </label>
          </div>

          <!-- API Permissions -->
          <div>
            <label class="label">
              <span class="label-text font-semibold">API Permissions</span>
            </label>
            <div class="grid grid-cols-2 gap-3">
              {#each Object.keys(selectedUser.apiPermissions || {}) as key}
                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-4">
                    <input type="checkbox" class="checkbox checkbox-success" bind:checked={selectedUser.apiPermissions[key]} />
                    <span class="label-text">{key.replace(/_/g, ' ')}</span>
                  </label>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" on:click={() => showEditModal = false}>Cancel</button>
          <button class="btn btn-primary" on:click={saveUser}>Save Changes</button>
        </div>
      </div>
    </div>
  {/if}
</main>
