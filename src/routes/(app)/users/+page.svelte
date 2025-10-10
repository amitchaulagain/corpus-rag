<script>
  import { onMount } from 'svelte';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  let users = [];
  let isLoading = true;
  let selectedUser = null;
  let showEditModal = false;
  let showAddModal = false;

  let newUser = {
    email: '',
    name: '',
    userType: 'freetier',
    isPaid: false
  };

  onMount(async () => {
    await loadUsers();
  });

  async function loadUsers() {
    isLoading = true;
    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/users-json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
      isLoading = false;
    }
  }

  function editUser(user) {
    selectedUser = JSON.parse(JSON.stringify(user)); // Deep clone
    showEditModal = true;
  }

  async function saveUser() {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/users-json', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(selectedUser)
      });

      if (response.ok) {
        alert('User updated successfully!');
        showEditModal = false;
        await loadUsers();
      } else {
        alert('Failed to update user');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('Error: ' + error.message);
    }
  }

  async function addUser() {
    if (!newUser.email || !newUser.name) {
      alert('Email and name are required');
      return;
    }

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/users-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        alert('User added successfully!');
        showAddModal = false;
        newUser = { email: '', name: '', userType: 'freetier', isPaid: false };
        await loadUsers();
      } else {
        const data = await response.json();
        alert('Failed to add user: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Error: ' + error.message);
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/users-json', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        alert('User deleted!');
        await loadUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  }

  function getUserTypeColor(type) {
    return type === 'admin' ? 'badge-error' : type === 'premium' ? 'badge-warning' : 'badge-info';
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-2 text-primary">👥 User Management</h1>
      <p class="text-base-content/70">Manage user accounts and permissions</p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary" on:click={() => showAddModal = true}>
        ➕ Add User
      </button>
      <a href="/dashboard" class="btn btn-ghost">← Dashboard</a>
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">All Users ({users.length})</h2>

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
                  <td class="flex items-center gap-2">
                    {#if user.picture}
                      <img src={user.picture} alt={user.name} class="w-8 h-8 rounded-full" />
                    {/if}
                    {user.name}
                  </td>
                  <td>
                    <span class="badge {getUserTypeColor(user.userType)}">
                      {user.userType}
                    </span>
                  </td>
                  <td>
                    <span class="badge {user.isPaid ? 'badge-success' : 'badge-ghost'}">
                      {user.isPaid ? '✓' : '✗'}
                    </span>
                  </td>
                  <td class="text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td class="text-sm">{new Date(user.lastLogin).toLocaleDateString()}</td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-sm btn-primary" on:click={() => editUser(user)}>
                        ✏️
                      </button>
                      <button class="btn btn-sm btn-error" on:click={() => deleteUser(user.id)}>
                        🗑️
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
        <h3 class="font-bold text-lg mb-4">✏️ Edit User</h3>
        <p class="text-sm text-base-content/70 mb-4">{selectedUser.email}</p>

        <div class="form-control gap-4">
          <!-- Name -->
          <div>
            <label class="label">
              <span class="label-text">Name</span>
            </label>
            <input type="text" class="input input-bordered w-full" bind:value={selectedUser.name} />
          </div>

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
              {#each Object.keys(selectedUser.apiPermissions) as key}
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

  <!-- Add User Modal -->
  {#if showAddModal}
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">➕ Add New User</h3>

        <div class="form-control gap-4">
          <div>
            <label class="label">
              <span class="label-text">Email *</span>
            </label>
            <input type="email" class="input input-bordered w-full" bind:value={newUser.email} placeholder="user@example.com" />
          </div>

          <div>
            <label class="label">
              <span class="label-text">Name *</span>
            </label>
            <input type="text" class="input input-bordered w-full" bind:value={newUser.name} placeholder="John Doe" />
          </div>

          <div>
            <label class="label">
              <span class="label-text">User Type</span>
            </label>
            <select class="select select-bordered w-full" bind:value={newUser.userType}>
              <option value="freetier">Free Tier</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" class="checkbox checkbox-primary" bind:checked={newUser.isPaid} />
              <span class="label-text">Paid Account</span>
            </label>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" on:click={() => showAddModal = false}>Cancel</button>
          <button class="btn btn-primary" on:click={addUser}>Add User</button>
        </div>
      </div>
    </div>
  {/if}
</main>
</AdminGuard>
