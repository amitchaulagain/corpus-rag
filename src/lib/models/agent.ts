// Agent Model and Types
import { ObjectId, type Db } from 'mongodb';

export interface Agent {
  _id?: ObjectId;
  userId: ObjectId;                 // Reference to User (agent user)
  agencyName: string;               // Agency/company name
  licenseNumber?: string;          // Business license if required
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  commissionRate: number;           // Percentage charged per application (e.g., 15)
  fixedFee?: number;                // Fixed fee per application (alternative to %)
  billingMethod: 'percentage' | 'fixed' | 'hybrid';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentJobSeekerRelationship {
  _id?: ObjectId;
  agentId: ObjectId;                // Agent/Agency
  jobSeekerId: ObjectId;            // Job seeker user
  status: 'active' | 'suspended' | 'terminated';
  contractTerms?: {
    commissionRate?: number;         // Override default agent rate
    fixedFee?: number;
    maxApplications?: number;        // Limit on applications
    expiresAt?: Date;                // Contract expiry
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentApplication {
  _id?: ObjectId;
  jobId: ObjectId;                   // Job being applied to
  jobSeekerId: ObjectId;             // Job seeker (who the application is for)
  agentId: ObjectId;                 // Agent who submitted the application
  applicationData: {
    coverLetter: string;
    resume: string;
    answers?: Array<{ question: string; answer: string }>;
  };
  charges: {
    amount: number;                  // Amount charged to job seeker
    baseCost?: number;               // Base cost of application (before commission)
    commissionRate?: number;         // Commission rate used
    fixedFee?: number;              // Fixed fee if applicable
    currency: string;                // e.g., "USD", "AUD"
    status: 'pending' | 'charged' | 'refunded';
    chargedAt?: Date;
    refundedAt?: Date;
    refundReason?: string;
    refundedBy?: ObjectId;
    transactionId?: string;          // Payment transaction ID
  };
  status: 'pending' | 'submitted' | 'rejected' | 'accepted';
  submittedAt: Date;
  createdAt: Date;
}

export class AgentModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // Agent CRUD
  async create(agentData: Omit<Agent, '_id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const agent: Agent = {
      ...agentData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<Agent>('agents').insertOne(agent);
    return { ...agent, _id: result.insertedId };
  }

  async findByUserId(userId: string | ObjectId): Promise<Agent | null> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await this.db.collection<Agent>('agents').findOne({ userId: objectId });
  }

  async findById(id: string | ObjectId): Promise<Agent | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<Agent>('agents').findOne({ _id: objectId });
  }

  async listAll(includeInactive = false): Promise<Agent[]> {
    const query = includeInactive ? {} : { isActive: true };
    return await this.db.collection<Agent>('agents').find(query).toArray();
  }

  async update(id: string | ObjectId, updates: Partial<Omit<Agent, '_id' | 'createdAt'>>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.db.collection<Agent>('agents').updateOne(
      { _id: objectId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  // Agent-Job Seeker Relationships
  async createRelationship(relationshipData: Omit<AgentJobSeekerRelationship, '_id' | 'createdAt' | 'updatedAt'>): Promise<AgentJobSeekerRelationship> {
    const relationship: AgentJobSeekerRelationship = {
      ...relationshipData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<AgentJobSeekerRelationship>('agent_job_seeker_relationships').insertOne(relationship);
    return { ...relationship, _id: result.insertedId };
  }

  async findRelationship(agentId: string | ObjectId, jobSeekerId: string | ObjectId): Promise<AgentJobSeekerRelationship | null> {
    const agentObjectId = typeof agentId === 'string' ? new ObjectId(agentId) : agentId;
    const jobSeekerObjectId = typeof jobSeekerId === 'string' ? new ObjectId(jobSeekerId) : jobSeekerId;
    return await this.db.collection<AgentJobSeekerRelationship>('agent_job_seeker_relationships').findOne({
      agentId: agentObjectId,
      jobSeekerId: jobSeekerObjectId
    });
  }

  async findActiveRelationshipsByAgent(agentId: string | ObjectId): Promise<AgentJobSeekerRelationship[]> {
    const objectId = typeof agentId === 'string' ? new ObjectId(agentId) : agentId;
    return await this.db.collection<AgentJobSeekerRelationship>('agent_job_seeker_relationships').find({
      agentId: objectId,
      status: 'active'
    }).toArray();
  }

  async findActiveRelationshipsByJobSeeker(jobSeekerId: string | ObjectId): Promise<AgentJobSeekerRelationship[]> {
    const objectId = typeof jobSeekerId === 'string' ? new ObjectId(jobSeekerId) : jobSeekerId;
    return await this.db.collection<AgentJobSeekerRelationship>('agent_job_seeker_relationships').find({
      jobSeekerId: objectId,
      status: 'active'
    }).toArray();
  }

  async updateRelationship(id: string | ObjectId, updates: Partial<Omit<AgentJobSeekerRelationship, '_id' | 'createdAt'>>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.db.collection<AgentJobSeekerRelationship>('agent_job_seeker_relationships').updateOne(
      { _id: objectId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  // Agent Applications
  async createApplication(applicationData: Omit<AgentApplication, '_id' | 'createdAt'>): Promise<AgentApplication> {
    const application: AgentApplication = {
      ...applicationData,
      createdAt: new Date()
    };

    const result = await this.db.collection<AgentApplication>('agent_applications').insertOne(application);
    return { ...application, _id: result.insertedId };
  }

  async findApplicationById(id: string | ObjectId): Promise<AgentApplication | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<AgentApplication>('agent_applications').findOne({ _id: objectId });
  }

  async findApplicationsByAgent(agentId: string | ObjectId, limit = 100): Promise<AgentApplication[]> {
    const objectId = typeof agentId === 'string' ? new ObjectId(agentId) : agentId;
    return await this.db.collection<AgentApplication>('agent_applications')
      .find({ agentId: objectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async findApplicationsByJobSeeker(jobSeekerId: string | ObjectId, limit = 100): Promise<AgentApplication[]> {
    const objectId = typeof jobSeekerId === 'string' ? new ObjectId(jobSeekerId) : jobSeekerId;
    return await this.db.collection<AgentApplication>('agent_applications')
      .find({ jobSeekerId: objectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async updateApplication(id: string | ObjectId, updates: Partial<Omit<AgentApplication, '_id' | 'createdAt'>> | Record<string, any>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    // Handle nested field updates (e.g., 'charges.status')
    const setUpdate: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      setUpdate[key] = value;
    }
    const result = await this.db.collection<AgentApplication>('agent_applications').updateOne(
      { _id: objectId },
      { $set: setUpdate }
    );
    return result.modifiedCount > 0;
  }

  // Calculate charge for application
  calculateCharge(
    agent: Agent,
    relationship?: AgentJobSeekerRelationship,
    baseCost: number = 1 // Base cost per application (could be token cost)
  ): number {
    // Use contract-specific terms if available, otherwise use agent defaults
    const commissionRate = relationship?.contractTerms?.commissionRate ?? agent.commissionRate;
    const fixedFee = relationship?.contractTerms?.fixedFee ?? agent.fixedFee ?? 0;

    let amount = 0;

    if (agent.billingMethod === 'percentage' || agent.billingMethod === 'hybrid') {
      amount += (baseCost * commissionRate) / 100;
    }

    if (agent.billingMethod === 'fixed' || agent.billingMethod === 'hybrid') {
      amount += fixedFee;
    }

    return Math.max(0, amount); // Ensure non-negative
  }
}
