<!-- Real-time API Health Monitor -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let healthStatus = 'checking';
  let lastUpdate = '';
  let responseTime = 0;
  let services = {
    storage: 'unknown',
    vertexAI: 'unknown',
    database: 'unknown'
  };
  let uptime = 0;
  let isExpanded = false;

  let healthInterval: NodeJS.Timeout | null = null;

  async function checkHealth() {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/system/status');
      const endTime = Date.now();
      responseTime = endTime - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          healthStatus = data.data.status;
          services = data.data.services;
          uptime = data.data.uptime;
          lastUpdate = new Date().toLocaleTimeString();
        } else {
          healthStatus = 'error';
        }
      } else {
        healthStatus = 'error';
      }
    } catch (error) {
      healthStatus = 'offline';
      responseTime = 0;
    }
  }

  onMount(() => {
    checkHealth();
    healthInterval = setInterval(checkHealth, 5000); // Check every 5 seconds
  });

  onDestroy(() => {
    if (healthInterval) {
      clearInterval(healthInterval);
    }
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'degraded': return '#ffc107';
      case 'down':
      case 'error':
      case 'offline': return '#dc3545';
      default: return '#6c757d';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'healthy': return '🟢';
      case 'degraded': return '🟡';
      case 'down':
      case 'error':
      case 'offline': return '🔴';
      case 'checking': return '🔵';
      default: return '⚪';
    }
  }

  function formatUptime(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
</script>

<div class="health-monitor" class:expanded={isExpanded}>
  <button
    class="status-badge"
    class:healthy={healthStatus === 'healthy'}
    class:degraded={healthStatus === 'degraded'}
    class:error={healthStatus === 'error' || healthStatus === 'offline'}
    class:checking={healthStatus === 'checking'}
    on:click={() => isExpanded = !isExpanded}
    title="Click to expand API health details"
  >
    <span class="status-icon">{getStatusIcon(healthStatus)}</span>
    <span class="status-text">API {healthStatus.toUpperCase()}</span>
    <span class="response-time">{responseTime}ms</span>
    <span class="expand-arrow" class:rotated={isExpanded}>▼</span>
  </button>

  {#if isExpanded}
    <div class="health-details">
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Last Check:</span>
          <span class="detail-value">{lastUpdate || 'Never'}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Response Time:</span>
          <span class="detail-value">{responseTime}ms</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Uptime:</span>
          <span class="detail-value">{formatUptime(uptime)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Storage:</span>
          <span class="detail-value">
            {getStatusIcon(services.storage)} {services.storage}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Vertex AI:</span>
          <span class="detail-value">
            {getStatusIcon(services.vertexAI)} {services.vertexAI}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Database:</span>
          <span class="detail-value">
            {getStatusIcon(services.database)} {services.database}
          </span>
        </div>
      </div>

      <div class="actions">
        <button class="refresh-btn" on:click={checkHealth}>
          🔄 Refresh Now
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .health-monitor {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 25px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    min-width: 120px;
  }

  .status-badge:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }

  .status-badge.healthy {
    border-color: #28a745;
    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  }

  .status-badge.degraded {
    border-color: #ffc107;
    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  }

  .status-badge.error {
    border-color: #dc3545;
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
  }

  .status-badge.checking {
    border-color: #667eea;
    background: linear-gradient(135deg, #e7f3ff 0%, #cce7ff 100%);
  }

  .status-icon {
    font-size: 14px;
  }

  .status-text {
    flex: 1;
    text-align: left;
  }

  .response-time {
    font-size: 11px;
    opacity: 0.8;
    font-weight: 500;
  }

  .expand-arrow {
    font-size: 10px;
    transition: transform 0.3s ease;
    opacity: 0.6;
  }

  .expand-arrow.rotated {
    transform: rotate(180deg);
  }

  .health-details {
    margin-top: 12px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    min-width: 280px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    font-size: 11px;
    color: #6c757d;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-value {
    font-size: 13px;
    font-weight: 600;
    color: #2c3e50;
  }

  .actions {
    border-top: 1px solid #e9ecef;
    padding-top: 12px;
    display: flex;
    justify-content: center;
  }

  .refresh-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .refresh-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  }

  @media (max-width: 768px) {
    .health-monitor {
      top: 10px;
      right: 10px;
    }

    .status-badge {
      padding: 6px 12px;
      font-size: 12px;
      min-width: 100px;
    }

    .health-details {
      min-width: 250px;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }
  }
</style>