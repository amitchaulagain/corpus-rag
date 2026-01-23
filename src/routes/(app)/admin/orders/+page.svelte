<script>
  import { onMount } from 'svelte';
  import '$styles/shared.css';

  let orders = [];
  let isLoading = true;
  let sessionToken = '';
  let currentUser = null;
  let selectedOrder = null;
  let showEditModal = false;
  let stats = null;
  let filters = {
    status: '',
    page: 1,
    limit: 50
  };

  onMount(async () => {
    sessionToken = localStorage.getItem('session_token') || '';
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

    await loadOrders();
  });

  async function loadOrders() {
    isLoading = true;
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          orders = data.data.orders;
          stats = data.data.stats;
        }
      } else {
        alert('Failed to load orders');
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      alert('Failed to load orders: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  function editOrder(order) {
    selectedOrder = { ...order };
    showEditModal = true;
  }

  async function saveOrder() {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          status: selectedOrder.status,
          paymentStatus: selectedOrder.paymentStatus,
          notes: selectedOrder.notes || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('✅ Order updated successfully! Tokens will be credited automatically if order is marked as completed.');
          showEditModal = false;
          await loadOrders();
        }
      } else {
        const errorData = await response.json();
        alert('Failed to update order: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order: ' + error.message);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount / 100); // Amount is in cents
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'processing':
        return 'badge-info';
      case 'failed':
      case 'cancelled':
        return 'badge-error';
      case 'refunded':
        return 'badge-ghost';
      default:
        return 'badge-ghost';
    }
  }

  function getPaymentStatusBadgeClass(paymentStatus) {
    switch (paymentStatus) {
      case 'succeeded':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  }

  function handleFilterChange() {
    filters.page = 1; // Reset to first page when filter changes
    loadOrders();
  }
</script>

<main class="container mx-auto max-w-7xl p-6">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold mb-4 text-primary">📦 Admin Orders</h1>
      <p class="text-base-content/70">Manage all customer orders and payments</p>
    </div>
    <div class="flex gap-2">
      <a href="/admin" class="btn btn-ghost">← Back to Admin</a>
      <a href="/" class="btn btn-ghost">← Home</a>
    </div>
  </div>

  <!-- Statistics -->
  {#if stats}
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <div class="stat bg-base-200 rounded-lg shadow">
        <div class="stat-title">Total Revenue</div>
        <div class="stat-value text-primary">{formatCurrency(stats.totalRevenue)}</div>
      </div>
      <div class="stat bg-base-200 rounded-lg shadow">
        <div class="stat-title">Total Orders</div>
        <div class="stat-value">{stats.totalOrders}</div>
      </div>
      <div class="stat bg-base-200 rounded-lg shadow">
        <div class="stat-title">Pending</div>
        <div class="stat-value text-warning">{stats.pendingOrders}</div>
      </div>
      <div class="stat bg-base-200 rounded-lg shadow">
        <div class="stat-title">Completed</div>
        <div class="stat-value text-success">{stats.completedOrders}</div>
      </div>
      <div class="stat bg-base-200 rounded-lg shadow">
        <div class="stat-title">Failed</div>
        <div class="stat-value text-error">{stats.failedOrders}</div>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="card bg-base-100 shadow-xl mb-6">
    <div class="card-body">
      <div class="flex gap-4 items-end">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Filter by Status</span>
          </label>
          <select class="select select-bordered" bind:value={filters.status} on:change={handleFilterChange}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <button class="btn btn-primary" on:click={loadOrders}>
          🔄 Refresh
        </button>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title mb-4">📦 Orders ({orders.length})</h2>

        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Order #</th>
                <th>User ID</th>
                <th>Plan</th>
                <th>Tokens</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Created</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each orders as order}
                <tr>
                  <td class="font-mono text-sm">{order.orderNumber}</td>
                  <td class="font-mono text-xs">{order.userId.substring(0, 8)}...</td>
                  <td>
                    <span class="badge badge-info">{order.planName || order.planId}</span>
                  </td>
                  <td class="font-mono">{order.tokensPurchased.toLocaleString()}</td>
                  <td class="font-mono">{formatCurrency(order.totalAmount || order.amount, order.currency)}</td>
                  <td>
                    <span class="badge {getStatusBadgeClass(order.status)}">
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <span class="badge {getPaymentStatusBadgeClass(order.paymentStatus)}">
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td class="text-sm">{formatDate(order.createdAt)}</td>
                  <td class="text-sm">{formatDate(order.completedAt)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary" on:click={() => editOrder(order)}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if orders.length === 0}
          <div class="text-center py-8 text-base-content/70">
            <p>No orders found</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Edit Order Modal -->
  {#if showEditModal && selectedOrder}
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Edit Order: {selectedOrder.orderNumber}</h3>

        <div class="form-control gap-4">
          <!-- Order Status -->
          <div>
            <label class="label">
              <span class="label-text font-semibold">Order Status</span>
            </label>
            <select class="select select-bordered w-full" bind:value={selectedOrder.status}>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <label class="label">
              <span class="label-text-alt text-warning">
                ⚠️ Setting status to "Completed" with payment "Succeeded" will automatically credit tokens to the user
              </span>
            </label>
          </div>

          <!-- Payment Status -->
          <div>
            <label class="label">
              <span class="label-text font-semibold">Payment Status</span>
            </label>
            <select class="select select-bordered w-full" bind:value={selectedOrder.paymentStatus}>
              <option value="pending">Pending</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <!-- Notes -->
          <div>
            <label class="label">
              <span class="label-text font-semibold">Admin Notes</span>
            </label>
            <textarea 
              class="textarea textarea-bordered w-full" 
              bind:value={selectedOrder.notes}
              placeholder="Add any notes about this order..."
              rows="4"
            ></textarea>
          </div>

          <!-- Order Info -->
          <div class="bg-base-200 p-4 rounded-lg">
            <div class="text-sm space-y-2">
              <div><strong>Plan:</strong> {selectedOrder.planName || selectedOrder.planId}</div>
              <div><strong>Tokens:</strong> {selectedOrder.tokensPurchased.toLocaleString()}</div>
              <div><strong>Amount:</strong> {formatCurrency(selectedOrder.totalAmount || selectedOrder.amount, selectedOrder.currency)}</div>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" on:click={() => showEditModal = false}>Cancel</button>
          <button class="btn btn-primary" on:click={saveOrder}>Save Changes</button>
        </div>
      </div>
    </div>
  {/if}
</main>
