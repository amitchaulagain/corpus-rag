#!/usr/bin/env node

// Development API Test Runner
// Runs automatically when npm run dev is started

const BASE_URL = 'http://localhost:3000/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSystemStatus() {
  try {
    const response = await fetch(`${BASE_URL}/system/status`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ API System Status: HEALTHY');
      console.log(`   - Response Time: ${data.data.responseTime}ms`);
      console.log(`   - Storage: ${data.data.services.storage}`);
      console.log(`   - Vertex AI: ${data.data.services.vertexAI}`);
      return true;
    } else {
      console.log('❌ API System Status: FAILED');
      console.log(`   - Error: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.log('🔄 API not ready yet, will retry...');
    return false;
  }
}

async function runDevTests() {
  console.log('\n🧪 Running Development API Tests...');
  console.log('─'.repeat(50));

  // Wait for server to be ready
  let attempts = 0;
  while (attempts < 10) {
    const isHealthy = await testSystemStatus();
    if (isHealthy) {
      break;
    }
    attempts++;
    await sleep(2000);
  }

  if (attempts >= 10) {
    console.log('❌ Server not responding after 20 seconds');
    return;
  }

  console.log('\n🎯 Server is ready!');
  console.log('📖 Access the app: http://localhost:3000');
  console.log('🚀 API Tester: Click the "🚀 API Tester" tab in the UI');
  console.log('🔑 Generate API keys directly in the interface');
  console.log('\n💡 The UI now includes:');
  console.log('   • Built-in API key generator');
  console.log('   • Live endpoint testing');
  console.log('   • Real-time request/response viewer');
  console.log('   • Interactive documentation');
  console.log('\n✨ Development mode active - API tests integrated into UI!');
}

runDevTests().catch(console.error);