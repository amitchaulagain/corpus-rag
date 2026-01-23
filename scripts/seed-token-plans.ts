// Seed script for default token plans
import { MongoClient } from 'mongodb';
import type { TokenPlan } from '../src/lib/models/token-plan';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'inquisitive_mind';

const defaultPlans: Omit<TokenPlan, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    planId: 'silver',
    name: 'Silver Plan',
    description: 'Perfect for occasional job seekers',
    price: 999, // $9.99 in cents
    currency: 'usd',
    tokensIncluded: 100,
    bonusTokens: 0,
    features: [
      '100 tokens',
      'Basic support',
      'Cover letter generation',
      'Resume tailoring',
      'Q&A generation'
    ],
    displayOrder: 1,
    isPopular: false,
    isActive: true
  },
  {
    planId: 'gold',
    name: 'Gold Plan',
    description: 'Best value for active job seekers',
    price: 2499, // $24.99 in cents
    currency: 'usd',
    tokensIncluded: 500,
    bonusTokens: 100, // Buy 500, get 100 free
    features: [
      '500 tokens',
      '100 bonus tokens',
      'Priority support',
      'Cover letter generation',
      'Resume tailoring',
      'Q&A generation',
      'Advanced AI models'
    ],
    displayOrder: 2,
    isPopular: true,
    badge: 'Best Value',
    isActive: true
  },
  {
    planId: 'diamond',
    name: 'Diamond Plan',
    description: 'For power users and agencies',
    price: 4999, // $49.99 in cents
    currency: 'usd',
    tokensIncluded: 1500,
    bonusTokens: 500, // Buy 1500, get 500 free
    features: [
      '1500 tokens',
      '500 bonus tokens',
      'Priority support',
      'Cover letter generation',
      'Resume tailoring',
      'Q&A generation',
      'Advanced AI models',
      'API access',
      'Bulk operations'
    ],
    displayOrder: 3,
    isPopular: false,
    isActive: true
  }
];

async function seedTokenPlans() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection<TokenPlan>('token_plans');

    // Clear existing plans (optional - comment out if you want to keep existing)
    // await collection.deleteMany({});
    // console.log('🗑️  Cleared existing token plans');

    console.log('\n📦 Seeding token plans...\n');

    for (const plan of defaultPlans) {
      // Check if plan already exists
      const existing = await collection.findOne({ planId: plan.planId });
      
      if (existing) {
        // Update existing plan
        await collection.updateOne(
          { planId: plan.planId },
          { 
            $set: {
              ...plan,
              updatedAt: new Date()
            }
          }
        );
        console.log(`  ✅ Updated: ${plan.name} (${plan.planId})`);
      } else {
        // Insert new plan
        await collection.insertOne({
          ...plan,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`  ✅ Created: ${plan.name} (${plan.planId})`);
      }
    }

    console.log('\n🎉 Token plans seeded successfully!');
    console.log('\n📊 Summary:');
    for (const plan of defaultPlans) {
      const price = (plan.price / 100).toFixed(2);
      const totalTokens = plan.tokensIncluded + (plan.bonusTokens || 0);
      console.log(`  • ${plan.name}: $${price} - ${totalTokens} tokens (${plan.tokensIncluded} + ${plan.bonusTokens || 0} bonus)`);
    }

  } catch (error) {
    console.error('❌ Error seeding token plans:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTokenPlans()
    .then(() => {
      console.log('\n✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed script failed:', error);
      process.exit(1);
    });
}

export { seedTokenPlans };
