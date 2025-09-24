// Test script for per-user corpus functionality
import { VertexCorpusManager } from './rag-ui/src/lib/corpus-manager.js';
import { VertexRAGClient } from './rag-ui/src/lib/rag-client.js';

const projectId = '439974099982';
const location = 'us-east4';

async function testPerUserCorpus() {
  console.log('🧪 Testing per-user corpus functionality...\n');

  const corpusManager = new VertexCorpusManager({
    projectId,
    location
  });

  const ragClient = new VertexRAGClient({
    projectId,
    location
  });

  // Test with two different users
  const testUsers = ['test-user-1', 'test-user-2'];

  for (const userId of testUsers) {
    console.log(`👤 Testing with user: ${userId}`);

    try {
      // 1. Get or create corpus for user
      console.log('   📦 Getting/creating corpus...');
      const corpusResult = await corpusManager.getUserCorpus(userId);

      if (corpusResult.success) {
        console.log(`   ✅ Corpus ${corpusResult.exists ? 'found' : 'created'}: ${corpusResult.corpusId}`);
      } else {
        console.log(`   ❌ Corpus error: ${corpusResult.error}`);
        continue;
      }

      // 2. Test query (will use the resolved corpus)
      console.log('   🔍 Testing RAG query...');
      const queryResult = await ragClient.query({
        userId,
        question: 'What skills do I have?'
      });

      if (queryResult.success) {
        console.log(`   ✅ Query successful`);
      } else {
        console.log(`   ⚠️  Query failed (expected if no docs): ${queryResult.error}`);
      }

    } catch (error) {
      console.log(`   ❌ Error testing user ${userId}:`, error);
    }

    console.log('');
  }

  // 3. List all corpora to verify separation
  console.log('📋 Listing all corpora...');
  const listResult = await corpusManager.listCorpora();

  if (listResult.success && listResult.corpora) {
    console.log(`   Found ${listResult.corpora.length} corpora:`);
    listResult.corpora.forEach((corpus, index) => {
      console.log(`   ${index + 1}. ${corpus.displayName} (ID: ${corpus.corpusId})`);
    });
  } else {
    console.log(`   ❌ Failed to list corpora: ${listResult.error}`);
  }

  console.log('\n🎉 Test completed!');
}

// Run the test
testPerUserCorpus().catch(console.error);