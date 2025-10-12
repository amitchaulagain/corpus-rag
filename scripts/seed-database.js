// Seed database with mock data
import { MongoClient, ObjectId } from 'mongodb';
import { createHash, randomBytes } from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'inquisitive_mind';

async function generateApiKey() {
  const key = 'sk_' + randomBytes(24).toString('hex');
  const keyHash = createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.substring(0, 12);
  return { key, keyHash, keyPrefix };
}

async function seedDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB_NAME);

    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await db.collection('users').deleteMany({});
    await db.collection('sessions').deleteMany({});
    await db.collection('jobs').deleteMany({});
    await db.collection('usage').deleteMany({});
    await db.collection('api_keys').deleteMany({});
    console.log('✅ Cleared all collections');

    // ========================================
    // SEED USERS
    // ========================================
    console.log('\n👥 Creating users...');

    const users = [
      {
        _id: new ObjectId(),
        email: 'admin@example.com',
        googleId: 'google_' + randomBytes(16).toString('hex'),
        name: 'Admin User',
        picture: 'https://ui-avatars.com/api/?name=Admin+User',
        userType: 'admin',
        isPaid: true,
        apiPermissions: {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        },
        platforms: [
          {
            platform: 'seek',
            credentials: { encrypted_data: 'encrypted_seek_creds' },
            isActive: true,
            lastSync: new Date(),
            metadata: { totalJobs: 45 }
          },
          {
            platform: 'linkedin',
            credentials: { encrypted_data: 'encrypted_linkedin_creds' },
            isActive: true,
            lastSync: new Date(),
            metadata: { totalJobs: 32 }
          }
        ],
        preferences: {
          notifications: true,
          autoApply: false,
          preferredAIProvider: 'openai'
        },
        createdAt: new Date('2024-01-15'),
        lastLogin: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        email: 'premium@example.com',
        googleId: 'google_' + randomBytes(16).toString('hex'),
        name: 'Premium User',
        picture: 'https://ui-avatars.com/api/?name=Premium+User',
        userType: 'premium',
        isPaid: true,
        apiPermissions: {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        },
        platforms: [
          {
            platform: 'seek',
            credentials: { encrypted_data: 'encrypted_seek_creds' },
            isActive: true,
            lastSync: new Date(Date.now() - 3600000),
            metadata: { totalJobs: 28 }
          }
        ],
        preferences: {
          notifications: true,
          autoApply: true,
          preferredAIProvider: 'anthropic'
        },
        createdAt: new Date('2024-02-20'),
        lastLogin: new Date(Date.now() - 86400000),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        email: 'free@example.com',
        googleId: 'google_' + randomBytes(16).toString('hex'),
        name: 'Free User',
        picture: 'https://ui-avatars.com/api/?name=Free+User',
        userType: 'freetier',
        isPaid: false,
        apiPermissions: {
          cover_letter: true,
          resume: false,
          questionAndAnswers: true,
          upload: false,
          jobs: true
        },
        platforms: [],
        preferences: {
          notifications: false,
          autoApply: false,
          preferredAIProvider: 'openai'
        },
        createdAt: new Date('2024-03-10'),
        lastLogin: new Date(Date.now() - 172800000),
        updatedAt: new Date()
      }
    ];

    await db.collection('users').insertMany(users);
    console.log(`✅ Created ${users.length} users`);

    // ========================================
    // SEED SESSIONS
    // ========================================
    console.log('\n🔐 Creating sessions...');

    const sessions = [
      {
        _id: new ObjectId(),
        userId: users[0]._id,
        token: 'session_' + randomBytes(32).toString('hex'),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      },
      {
        _id: new ObjectId(),
        userId: users[1]._id,
        token: 'session_' + randomBytes(32).toString('hex'),
        createdAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
      }
    ];

    await db.collection('sessions').insertMany(sessions);
    console.log(`✅ Created ${sessions.length} sessions`);

    // ========================================
    // SEED API KEYS
    // ========================================
    console.log('\n🔑 Creating API keys...');

    const adminKey = await generateApiKey();
    const premiumKey = await generateApiKey();
    const freeKey = await generateApiKey();

    const apiKeys = [
      {
        _id: new ObjectId(),
        userId: users[0]._id,
        keyHash: adminKey.keyHash,
        keyPrefix: adminKey.keyPrefix,
        name: 'Admin API Key',
        scopes: ['admin', 'cover_letter', 'resume', 'questionAndAnswers', 'upload', 'jobs', 'files:read', 'files:write'],
        isActive: true,
        createdAt: new Date('2024-01-15'),
        lastUsed: new Date()
      },
      {
        _id: new ObjectId(),
        userId: users[1]._id,
        keyHash: premiumKey.keyHash,
        keyPrefix: premiumKey.keyPrefix,
        name: 'Premium User Key',
        scopes: ['cover_letter', 'resume', 'questionAndAnswers', 'files:read'],
        isActive: true,
        createdAt: new Date('2024-02-20'),
        lastUsed: new Date(Date.now() - 3600000)
      },
      {
        _id: new ObjectId(),
        userId: users[2]._id,
        keyHash: freeKey.keyHash,
        keyPrefix: freeKey.keyPrefix,
        name: 'Free User Key',
        scopes: ['cover_letter', 'files:read'],
        isActive: true,
        createdAt: new Date('2024-03-10'),
        lastUsed: new Date(Date.now() - 86400000)
      }
    ];

    await db.collection('api_keys').insertMany(apiKeys);
    console.log(`✅ Created ${apiKeys.length} API keys`);
    console.log(`\n📋 API Keys (save these for testing):`);
    console.log(`   Admin:   ${adminKey.key}`);
    console.log(`   Premium: ${premiumKey.key}`);
    console.log(`   Free:    ${freeKey.key}`);

    // ========================================
    // SEED JOBS
    // ========================================
    console.log('\n💼 Creating jobs...');

    const companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Tesla', 'SpaceX', 'Stripe', 'Airbnb'];
    const titles = ['Software Engineer', 'Senior Developer', 'Full Stack Developer', 'Backend Engineer', 'Frontend Developer', 'DevOps Engineer', 'Data Scientist', 'ML Engineer'];
    const locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Remote', 'Boston, MA', 'Los Angeles, CA'];
    const statuses = ['pending', 'applied', 'rejected', 'interview', 'offer'];
    const platforms = ['seek', 'linkedin', 'indeed'];

    const jobs = [];

    // Create jobs for admin user
    for (let i = 0; i < 15; i++) {
      const hasApplication = Math.random() > 0.3;
      const job = {
        _id: new ObjectId(),
        userId: users[0]._id,
        platform: platforms[i % platforms.length],
        platformJobId: `job_${randomBytes(8).toString('hex')}`,
        title: titles[i % titles.length],
        company: companies[i % companies.length],
        location: locations[i % locations.length],
        salary: `$${80 + i * 10}k - $${120 + i * 10}k`,
        description: `Exciting opportunity for a ${titles[i % titles.length]} at ${companies[i % companies.length]}. We're looking for talented engineers to join our growing team.`,
        url: `https://jobs.example.com/job/${i}`,
        postedDate: new Date(Date.now() - i * 86400000),
        closingDate: new Date(Date.now() + (30 - i) * 86400000),
        jobType: i % 2 === 0 ? 'full-time' : 'contract',
        workMode: i % 3 === 0 ? 'remote' : 'hybrid',
        status: hasApplication ? statuses[i % statuses.length] : 'pending',
        firstSeenAt: new Date(Date.now() - i * 86400000),
        lastUpdatedAt: new Date(Date.now() - (i * 3600000))
      };

      if (hasApplication) {
        job.application = {
          status: statuses[i % statuses.length],
          appliedAt: new Date(Date.now() - (i * 3600000)),
          coverLetter: `Dear Hiring Manager,\n\nI am excited to apply for the ${job.title} position at ${job.company}...`,
          tailoredResume: 'Resume tailored for this position...',
          questionAnswers: [
            { question: 'Why do you want to work here?', answer: 'I am passionate about...' },
            { question: 'What are your salary expectations?', answer: 'Based on my experience...' }
          ],
          apiCalls: [
            {
              timestamp: new Date(Date.now() - (i * 3600000)),
              endpoint: '/api/cover_letter',
              aiProvider: 'openai',
              request: { model: 'gpt-4', prompt: '...' },
              response: { text: '...', model: 'gpt-4' },
              tokensUsed: 1500,
              cost: 0.045,
              processingTime: 2.3
            }
          ],
          automationLogs: [
            {
              timestamp: new Date(Date.now() - (i * 3600000)),
              action: 'Application submitted',
              success: true,
              message: 'Successfully submitted application'
            }
          ],
          createdAt: new Date(Date.now() - (i * 3600000)),
          updatedAt: new Date(Date.now() - (i * 1800000))
        };
      }

      jobs.push(job);
    }

    // Create jobs for premium user
    for (let i = 0; i < 10; i++) {
      const hasApplication = Math.random() > 0.4;
      const job = {
        _id: new ObjectId(),
        userId: users[1]._id,
        platform: platforms[i % platforms.length],
        platformJobId: `job_${randomBytes(8).toString('hex')}`,
        title: titles[i % titles.length],
        company: companies[i % companies.length],
        location: locations[i % locations.length],
        salary: `$${70 + i * 8}k - $${110 + i * 8}k`,
        description: `Great opportunity at ${companies[i % companies.length]}.`,
        url: `https://jobs.example.com/job/${100 + i}`,
        postedDate: new Date(Date.now() - i * 86400000),
        closingDate: new Date(Date.now() + (25 - i) * 86400000),
        jobType: 'full-time',
        workMode: i % 2 === 0 ? 'remote' : 'onsite',
        status: hasApplication ? statuses[i % statuses.length] : 'pending',
        firstSeenAt: new Date(Date.now() - i * 86400000),
        lastUpdatedAt: new Date(Date.now() - (i * 3600000))
      };

      if (hasApplication) {
        job.application = {
          status: statuses[i % statuses.length],
          appliedAt: new Date(Date.now() - (i * 3600000)),
          coverLetter: `Cover letter for ${job.title}...`,
          tailoredResume: 'Tailored resume...',
          questionAnswers: [],
          apiCalls: [],
          automationLogs: [],
          createdAt: new Date(Date.now() - (i * 3600000)),
          updatedAt: new Date(Date.now() - (i * 1800000))
        };
      }

      jobs.push(job);
    }

    // Create jobs for free user
    for (let i = 0; i < 5; i++) {
      jobs.push({
        _id: new ObjectId(),
        userId: users[2]._id,
        platform: 'seek',
        platformJobId: `job_${randomBytes(8).toString('hex')}`,
        title: titles[i % titles.length],
        company: companies[i % companies.length],
        location: locations[i % locations.length],
        salary: `$${60 + i * 5}k - $${90 + i * 5}k`,
        description: `Entry level position at ${companies[i % companies.length]}.`,
        url: `https://jobs.example.com/job/${200 + i}`,
        postedDate: new Date(Date.now() - i * 86400000),
        closingDate: new Date(Date.now() + (20 - i) * 86400000),
        jobType: 'full-time',
        workMode: 'onsite',
        status: 'pending',
        firstSeenAt: new Date(Date.now() - i * 86400000),
        lastUpdatedAt: new Date(Date.now() - (i * 3600000))
      });
    }

    await db.collection('jobs').insertMany(jobs);
    console.log(`✅ Created ${jobs.length} jobs`);

    // ========================================
    // SEED USAGE
    // ========================================
    console.log('\n📊 Creating usage records...');

    const endpoints = ['/api/cover_letter', '/api/resume', '/api/questionAndAnswers', '/api/jobs/hierarchy'];
    const providers = ['openai', 'anthropic'];

    const usage = [];

    for (let i = 0; i < 50; i++) {
      usage.push({
        _id: new ObjectId(),
        userId: users[i % 2]._id,
        endpoint: endpoints[i % endpoints.length],
        aiProvider: providers[i % providers.length],
        tokensUsed: 500 + Math.floor(Math.random() * 2000),
        cost: 0.01 + Math.random() * 0.1,
        success: Math.random() > 0.1,
        timestamp: new Date(Date.now() - i * 7200000),
        metadata: {
          jobId: jobs[i % jobs.length]._id.toString(),
          platform: platforms[i % platforms.length]
        }
      });
    }

    await db.collection('usage').insertMany(usage);
    console.log(`✅ Created ${usage.length} usage records`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Sessions: ${sessions.length}`);
    console.log(`   API Keys: ${apiKeys.length}`);
    console.log(`   Jobs: ${jobs.length}`);
    console.log(`   Usage: ${usage.length}`);
    console.log('\n🔗 Test the API with these credentials:');
    console.log(`   Admin Email: admin@example.com`);
    console.log(`   Premium Email: premium@example.com`);
    console.log(`   Free Email: free@example.com`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seedDatabase().catch(console.error);
