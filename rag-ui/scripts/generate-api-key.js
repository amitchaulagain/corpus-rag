#!/usr/bin/env node

// CLI tool to generate API keys for the RAG system

import { ApiAuth } from '../src/lib/api-auth.js';
import { readFileSync } from 'fs';

// Initialize the auth system
ApiAuth.initialize();

function showUsage() {
  console.log('Usage: node generate-api-key.js <userId> <name> [scopes...]');
  console.log('');
  console.log('Examples:');
  console.log('  node generate-api-key.js user@example.com "My App" files:read files:write rag:query');
  console.log('  node generate-api-key.js admin@example.com "Admin Key" admin');
  console.log('');
  console.log('Available scopes:');
  console.log('  files:read    - Read user files');
  console.log('  files:write   - Upload and manage files');
  console.log('  files:delete  - Delete files');
  console.log('  corpus:read   - Read corpus information');
  console.log('  corpus:write  - Manage corpus');
  console.log('  rag:query     - Query the RAG system');
  console.log('  rag:import    - Import files to RAG');
  console.log('  system:status - Read system status');
  console.log('  admin         - Full administrative access');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    showUsage();
    process.exit(1);
  }

  const [userId, name, ...scopes] = args;

  if (scopes.length === 0) {
    console.error('❌ Error: At least one scope is required');
    showUsage();
    process.exit(1);
  }

  try {
    const apiKey = ApiAuth.generateApiKey(userId, name, scopes);

    console.log('✅ API Key generated successfully!');
    console.log('');
    console.log('📋 Details:');
    console.log(`   User ID: ${apiKey.userId}`);
    console.log(`   Name: ${apiKey.name}`);
    console.log(`   Scopes: ${apiKey.scopes.join(', ')}`);
    console.log(`   Created: ${apiKey.createdAt}`);
    console.log('');
    console.log('🔑 API Key:');
    console.log(`   ${apiKey.key}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Save this key securely - it will not be shown again!');
    console.log('');
    console.log('📖 Usage:');
    console.log('   Include this in the Authorization header:');
    console.log(`   Authorization: Bearer ${apiKey.key}`);
    console.log('');
    console.log('🧪 Test with curl:');
    console.log(`   curl -H "Authorization: Bearer ${apiKey.key}" \\`);
    console.log('        https://your-domain.com/api/auth/me');

  } catch (error) {
    console.error('❌ Error generating API key:', error.message);
    process.exit(1);
  }
}

main();