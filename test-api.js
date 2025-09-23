#!/usr/bin/env node

// Simple API test script
// Run this after starting the server to test API endpoints

const BASE_URL = 'http://localhost:3000/api';

async function testSystemStatus() {
  console.log('🧪 Testing System Status...');
  try {
    const response = await fetch(`${BASE_URL}/system/status`);
    const data = await response.json();
    console.log('✅ System Status:', data.success ? 'OK' : 'FAILED');
    console.log('📊 Status:', data.data?.status || 'unknown');
  } catch (error) {
    console.log('❌ System Status test failed:', error.message);
  }
}

async function testWithApiKey(apiKey) {
  console.log('\n🔑 Testing with API Key...');

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  // Test auth/me endpoint
  try {
    const response = await fetch(`${BASE_URL}/auth/me`, { headers });
    const data = await response.json();
    console.log('✅ Auth test:', data.success ? 'OK' : 'FAILED');
    if (data.success) {
      console.log('👤 User ID:', data.data?.user?.id);
      console.log('🔑 API Key ID:', data.data?.apiKey?.id);
      console.log('🎯 Scopes:', data.data?.user?.scopes?.join(', '));
    } else {
      console.log('❌ Auth error:', data.error);
    }
  } catch (error) {
    console.log('❌ Auth test failed:', error.message);
  }

  // Test files endpoint
  try {
    const response = await fetch(`${BASE_URL}/files?userId=test-user@example.com`, { headers });
    const data = await response.json();
    console.log('✅ Files test:', data.success ? 'OK' : 'FAILED');
    if (data.success) {
      console.log('📁 Files count:', data.data?.count || 0);
    } else {
      console.log('❌ Files error:', data.error);
    }
  } catch (error) {
    console.log('❌ Files test failed:', error.message);
  }

  // Test corpus endpoint
  try {
    const response = await fetch(`${BASE_URL}/corpus?userId=test-user@example.com`, { headers });
    const data = await response.json();
    console.log('✅ Corpus test:', data.success ? 'OK' : 'FAILED');
    if (data.success) {
      console.log('📦 Corpus exists:', data.data?.exists);
      console.log('🆔 Corpus ID:', data.data?.corpusId);
    } else {
      console.log('❌ Corpus error:', data.error);
    }
  } catch (error) {
    console.log('❌ Corpus test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 RAG System API Test Suite\n');
  console.log('📍 Base URL:', BASE_URL);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('─'.repeat(50));

  // Test public endpoints
  await testSystemStatus();

  // Check if API key is provided via environment variable
  const apiKey = process.env.RAG_API_KEY;

  if (apiKey) {
    await testWithApiKey(apiKey);
  } else {
    console.log('\n💡 To test authenticated endpoints:');
    console.log('   1. Generate an API key at http://localhost:3000/api-docs');
    console.log('   2. Run: RAG_API_KEY=your-key node test-api.js');
  }

  console.log('\n🎯 Test completed!');
  console.log('📖 Full API docs: http://localhost:3000/api-docs');
}

main().catch(console.error);