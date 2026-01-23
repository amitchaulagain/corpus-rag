<!-- Agent Registration Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import { getAuthHeaders } from '$lib/auth-helper.js';

  let currentUser: any = null;
  let agentProfile = null;
  let isLoading = false;
  let isSubmitting = false;
  let showSuccess = false;

  let formData = {
    agencyName: '',
    licenseNumber: '',
    contactEmail: '',
    contactPhone: '',
    commissionRate: 15,
    fixedFee: 0,
    billingMethod: 'percentage'
  };

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
    } else {
      alert('Please log in');
      window.location.href = '/';
      return;
    }

    await checkExistingAgent();
  });

  async function checkExistingAgent() {
    isLoading = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agents/register', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          agentProfile = data.agent;
          // Pre-fill form with existing data
          formData.agencyName = data.agent.agencyName;
          formData.licenseNumber = data.agent.licenseNumber || '';
          formData.contactEmail = data.agent.contactEmail || '';
          formData.contactPhone = data.agent.contactPhone || '';
          formData.commissionRate = data.agent.commissionRate;
          formData.fixedFee = data.agent.fixedFee || 0;
          formData.billingMethod = data.agent.billingMethod;
        }
      }
    } catch (error) {
      console.error('Failed to check agent profile:', error);
    } finally {
      isLoading = false;
    }
  }

  async function submitRegistration() {
    if (!formData.agencyName) {
      alert('Agency name is required');
      return;
    }

    if (formData.billingMethod === 'percentage' || formData.billingMethod === 'hybrid') {
      if (!formData.commissionRate || formData.commissionRate <= 0) {
        alert('Commission rate is required for percentage/hybrid billing');
        return;
      }
    }

    if (formData.billingMethod === 'fixed' || formData.billingMethod === 'hybrid') {
      if (!formData.fixedFee || formData.fixedFee <= 0) {
        alert('Fixed fee is required for fixed/hybrid billing');
        return;
      }
    }

    isSubmitting = true;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agents/register', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showSuccess = true;
          agentProfile = data.agent;
          setTimeout(() => {
            window.location.href = '/agents/dashboard';
          }, 2000);
        } else {
          alert('Failed: ' + (data.error || 'Unknown error'));
        }
      } else {
        const data = await response.json();
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Error: ' + error.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<main class="container mx-auto max-w-3xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">
      {agentProfile ? '✏️ Update Agent Profile' : '🤝 Register as Agent'}
    </h1>
    <p class="text-base-content/70">
      {agentProfile 
        ? 'Update your agent profile and billing settings'
        : 'Register your agency to apply for jobs on behalf of job seekers'}
    </p>
  </div>

  {#if showSuccess}
    <div class="alert alert-success mb-6">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Registration successful! Redirecting to dashboard...</span>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <form on:submit|preventDefault={submitRegistration}>
          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text font-semibold">Agency Name *</span>
            </label>
            <input 
              type="text" 
              class="input input-bordered" 
              bind:value={formData.agencyName}
              placeholder="ABC Recruitment Agency"
              required
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">License Number</span>
            </label>
            <input 
              type="text" 
              class="input input-bordered" 
              bind:value={formData.licenseNumber}
              placeholder="LIC123456 (optional)"
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Contact Email</span>
            </label>
            <input 
              type="email" 
              class="input input-bordered" 
              bind:value={formData.contactEmail}
              placeholder={currentUser?.email || 'contact@agency.com'}
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Contact Phone</span>
            </label>
            <input 
              type="tel" 
              class="input input-bordered" 
              bind:value={formData.contactPhone}
              placeholder="+1234567890"
            />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text font-semibold">Billing Method *</span>
            </label>
            <select 
              class="select select-bordered w-full" 
              bind:value={formData.billingMethod}
            >
              <option value="percentage">Percentage (Commission %)</option>
              <option value="fixed">Fixed Fee (per application)</option>
              <option value="hybrid">Hybrid (Both % and fixed)</option>
            </select>
          </div>

          {(formData.billingMethod === 'percentage' || formData.billingMethod === 'hybrid') && (
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text font-semibold">Commission Rate (%) *</span>
              </label>
              <input 
                type="number" 
                class="input input-bordered" 
                bind:value={formData.commissionRate}
                min="0"
                max="100"
                step="0.1"
                placeholder="15"
                required
              />
              <label class="label">
                <span class="label-text-alt">Percentage of base cost charged as commission</span>
              </label>
            </div>
          )}

          {(formData.billingMethod === 'fixed' || formData.billingMethod === 'hybrid') && (
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text font-semibold">Fixed Fee (tokens) *</span>
              </label>
              <input 
                type="number" 
                class="input input-bordered" 
                bind:value={formData.fixedFee}
                min="0"
                step="0.01"
                placeholder="10"
                required
              />
              <label class="label">
                <span class="label-text-alt">Fixed amount charged per application</span>
              </label>
            </div>
          )}

          <div class="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 class="font-bold">Billing Information</h3>
              <div class="text-xs">
                <p><strong>Base Cost:</strong> 5 tokens per application (cover letter + resume + Q&A)</p>
                {formData.billingMethod === 'percentage' && (
                  <p><strong>Your Commission:</strong> {formData.commissionRate}% of base cost = {(5 * formData.commissionRate / 100).toFixed(2)} tokens</p>
                )}
                {formData.billingMethod === 'fixed' && (
                  <p><strong>Your Fee:</strong> {formData.fixedFee} tokens per application</p>
                )}
                {formData.billingMethod === 'hybrid' && (
                  <p><strong>Your Commission:</strong> {formData.commissionRate}% + {formData.fixedFee} tokens = {((5 * formData.commissionRate / 100) + formData.fixedFee).toFixed(2)} tokens per application</p>
                )}
              </div>
            </div>
          </div>

          <div class="form-control mt-6">
            <button 
              class="btn btn-primary w-full" 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span class="loading loading-spinner"></span>
                  Processing...
                </>
              ) : (
                agentProfile ? 'Update Profile' : 'Register as Agent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</main>
