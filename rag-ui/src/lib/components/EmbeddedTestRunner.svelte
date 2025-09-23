<!-- Embedded API Test Runner -->
<script lang="ts">
  import { onMount } from 'svelte';

  let testResults: Array<{
    id: string;
    name: string;
    status: 'running' | 'passed' | 'failed' | 'pending';
    time: number;
    error?: string;
    response?: any;
  }> = $state([]);

  let isRunning = $state(false);
  let totalTests = $state(0);
  let passedTests = $state(0);
  let failedTests = $state(0);
  let autoApiKey = $state('');
  interface Props {
    userId?: string;
  }

  let { userId = '' }: Props = $props();
  let testUserId = userId;

  const testSuite = [
    {
      id: 'health',
      name: 'System Health Check',
      endpoint: '/api/system/status',
      method: 'GET',
      requiresAuth: false
    },
    {
      id: 'auth-me',
      name: 'Authentication Check',
      endpoint: '/api/auth/me',
      method: 'GET',
      requiresAuth: true
    },
    {
      id: 'files-list',
      name: 'List Files',
      endpoint: '/api/files?userId=' + testUserId,
      method: 'GET',
      requiresAuth: true
    },
    {
      id: 'corpus-get',
      name: 'Get Corpus',
      endpoint: '/api/corpus?userId=' + testUserId,
      method: 'GET',
      requiresAuth: true
    }
  ];

  async function runTest(test: any, apiKey?: string) {
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {};
      if (test.requiresAuth && apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(test.endpoint, {
        method: test.method,
        headers
      });

      const data = await response.json();
      const endTime = Date.now();

      return {
        ...test,
        status: data.success ? 'passed' : 'failed',
        time: endTime - startTime,
        response: data,
        error: data.success ? undefined : data.error
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        ...test,
        status: 'failed',
        time: endTime - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function runAllTests(apiKey?: string) {
    if (isRunning) return;

    isRunning = true;
    testResults = testSuite.map(test => ({
      ...test,
      status: 'pending',
      time: 0
    }));
    totalTests = testSuite.length;
    passedTests = 0;
    failedTests = 0;

    for (let i = 0; i < testSuite.length; i++) {
      const test = testSuite[i];

      // Update status to running
      testResults[i] = { ...testResults[i], status: 'running' };
      testResults = [...testResults];

      // Run the test
      const result = await runTest(test, apiKey);

      // Update with result
      testResults[i] = result;
      testResults = [...testResults];

      if (result.status === 'passed') {
        passedTests++;
      } else {
        failedTests++;
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    isRunning = false;
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '⏳';
      case 'pending': return '⏸️';
      default: return '⚪';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'running': return '#007bff';
      case 'pending': return '#6c757d';
      default: return '#6c757d';
    }
  }

  // Load test API key and run basic health check on mount
  onMount(async () => {
    await loadTestCredentials();
    runTest(testSuite[0]).then(result => {
      testResults = [result];
    });
  });

  async function loadTestCredentials() {
    if (!userId) {
      console.warn('No userId provided for test credentials');
      return;
    }
    
    try {
      // Pass the actual userId to generate API key for the logged-in user
      const response = await fetch(`/api/auth/test-key?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();

      if (data.success) {
        autoApiKey = data.data.apiKey;
        testUserId = data.data.testUserId;
        console.log(`🔑 Test credentials loaded automatically for user: ${testUserId}`);
      }
    } catch (error) {
      console.warn('Failed to load test credentials:', error);
    }
  }
</script>

<div class="test-runner">
  <div class="runner-header">
    <h3>🧪 Embedded API Tests</h3>
    <div class="test-stats">
      <span class="stat passed">✅ {passedTests}</span>
      <span class="stat failed">❌ {failedTests}</span>
      <span class="stat total">📊 {totalTests}</span>
    </div>
  </div>

  <div class="test-controls">
    <button
      class="run-tests-btn"
      onclick={() => runAllTests()}
      disabled={isRunning}
    >
      {isRunning ? '⏳ Running Tests...' : '🚀 Run API Tests'}
    </button>

    <button
      class="run-auth-tests-btn"
      onclick={() => {
        if (autoApiKey) {
          runAllTests(autoApiKey);
        } else {
          const apiKey = prompt('Enter API Key for authenticated tests:');
          if (apiKey) runAllTests(apiKey);
        }
      }}
      disabled={isRunning}
    >
      🔐 Run with Auth {autoApiKey ? '(Auto)' : ''}
    </button>
  </div>

  <div class="test-results">
    {#each testResults as test}
      <div class="test-item" style="border-left-color: {getStatusColor(test.status)}">
        <div class="test-info">
          <span class="test-icon">{getStatusIcon(test.status)}</span>
          <div class="test-details">
            <div class="test-name">{test.name}</div>
            <div class="test-endpoint">{test.method} {test.endpoint}</div>
          </div>
          <div class="test-metrics">
            <span class="test-time">{test.time}ms</span>
          </div>
        </div>

        {#if test.error}
          <div class="test-error">
            <strong>Error:</strong> {test.error}
          </div>
        {/if}

        {#if test.response && test.status === 'passed'}
          <details class="test-response">
            <summary>View Response</summary>
            <pre>{JSON.stringify(test.response, null, 2)}</pre>
          </details>
        {/if}
      </div>
    {/each}

    {#if testResults.length === 0}
      <div class="empty-state">
        <p>🎯 Click "Run API Tests" to start testing your endpoints</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .test-runner {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
  }

  .runner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #f8f9fa;
  }

  .runner-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.2rem;
  }

  .test-stats {
    display: flex;
    gap: 12px;
  }

  .stat {
    font-size: 14px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 8px;
    background: #f8f9fa;
  }

  .stat.passed { color: #28a745; }
  .stat.failed { color: #dc3545; }
  .stat.total { color: #007bff; }

  .test-controls {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .run-tests-btn, .run-auth-tests-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
  }

  .run-tests-btn {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
  }

  .run-auth-tests-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .run-tests-btn:hover:not(:disabled),
  .run-auth-tests-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .run-tests-btn:disabled,
  .run-auth-tests-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .test-results {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .test-item {
    border: 1px solid #e9ecef;
    border-left: 4px solid #6c757d;
    border-radius: 8px;
    padding: 16px;
    background: #fafafa;
    transition: all 0.3s ease;
  }

  .test-item:hover {
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .test-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .test-icon {
    font-size: 16px;
    min-width: 20px;
  }

  .test-details {
    flex: 1;
  }

  .test-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 4px;
  }

  .test-endpoint {
    font-size: 12px;
    color: #6c757d;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .test-metrics {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .test-time {
    font-size: 12px;
    color: #6c757d;
    font-weight: 500;
  }

  .test-error {
    margin-top: 12px;
    padding: 12px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #721c24;
    font-size: 14px;
  }

  .test-response {
    margin-top: 12px;
  }

  .test-response summary {
    cursor: pointer;
    font-weight: 600;
    color: #667eea;
    font-size: 14px;
  }

  .test-response pre {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 12px;
    margin-top: 8px;
    font-size: 12px;
    overflow-x: auto;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6c757d;
  }

  @media (max-width: 768px) {
    .runner-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .test-controls {
      flex-direction: column;
    }

    .test-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .test-metrics {
      align-self: flex-end;
    }
  }
</style>