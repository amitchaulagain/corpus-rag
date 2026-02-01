/**
 * Clear all job analytics data (jobs collection).
 * Run from corpus-rag: bun run scripts/clear-job-analytics.ts
 */
import { getDB } from '../src/lib/db/mongodb.js';

async function clearJobAnalytics() {
  const db = await getDB();
  const result = await db.collection('jobs').deleteMany({});
  console.log(`✅ Job analytics cleared: ${result.deletedCount} job(s) deleted.`);
}

clearJobAnalytics().catch((err) => {
  console.error('❌ Failed to clear job analytics:', err);
  process.exit(1);
});
