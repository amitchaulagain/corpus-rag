// Export MongoDB jobs database to JSON
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = 'inquisitive_mind';

async function exportJobsDatabase() {
  let client: MongoClient | null = null;

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);

    console.log('📊 Fetching all jobs from database...');
    const jobs = await db.collection('jobs').find({}).toArray();

    console.log(`✅ Found ${jobs.length} jobs in database`);

    // Export full database
    const fullExportPath = path.join(__dirname, 'jobs_database_export_full.json');
    fs.writeFileSync(fullExportPath, JSON.stringify(jobs, null, 2));
    console.log(`📁 Full export saved to: ${fullExportPath}`);

    // Export summary (without rawData for smaller file)
    const jobsSummary = jobs.map(job => ({
      _id: job._id,
      userId: job.userId,
      platform: job.platform,
      platformJobId: job.platformJobId,
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      url: job.url,
      postedDate: job.postedDate,
      closingDate: job.closingDate,
      jobType: job.jobType,
      workMode: job.workMode,
      status: job.status,
      application: job.application,
      firstSeenAt: job.firstSeenAt,
      lastUpdatedAt: job.lastUpdatedAt
    }));

    const summaryExportPath = path.join(__dirname, 'jobs_database_export_summary.json');
    fs.writeFileSync(summaryExportPath, JSON.stringify(jobsSummary, null, 2));
    console.log(`📁 Summary export saved to: ${summaryExportPath}`);

    // Generate statistics
    const stats = {
      totalJobs: jobs.length,
      byPlatform: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byCompany: {} as Record<string, number>,
      withApplications: 0,
      totalApiCalls: 0
    };

    jobs.forEach(job => {
      // Platform stats
      stats.byPlatform[job.platform] = (stats.byPlatform[job.platform] || 0) + 1;

      // Status stats
      stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;

      // Company stats
      if (job.company) {
        stats.byCompany[job.company] = (stats.byCompany[job.company] || 0) + 1;
      }

      // Application stats
      if (job.application) {
        stats.withApplications++;
        stats.totalApiCalls += job.application.apiCalls?.length || 0;
      }
    });

    // Export stats
    const statsPath = path.join(__dirname, 'jobs_database_stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`📊 Statistics saved to: ${statsPath}`);

    console.log('\n📈 Database Statistics:');
    console.log(`Total jobs: ${stats.totalJobs}`);
    console.log(`Jobs with applications: ${stats.withApplications}`);
    console.log(`Total API calls: ${stats.totalApiCalls}`);
    console.log(`\nPlatforms: ${Object.entries(stats.byPlatform).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log(`Statuses: ${Object.entries(stats.byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log(`\nTop 5 companies:`);
    Object.entries(stats.byCompany)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([company, count]) => console.log(`  ${company}: ${count} jobs`));

    console.log('\n✅ Database export complete!');

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

exportJobsDatabase();
