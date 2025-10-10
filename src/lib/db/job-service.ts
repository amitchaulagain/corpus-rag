// Job tracking service for automation bots (Seek, LinkedIn, etc.)
import { connectToDatabase, ObjectId } from './mongodb';

export type PlatformType = 'seek' | 'linkedin' | 'indeed' | 'other';
export type ApplicationStatus = 'pending' | 'applied' | 'rejected' | 'interview' | 'offer' | 'withdrawn';

// Platform-specific configuration for each user
export interface UserPlatform {
  _id?: ObjectId;
  id?: string;
  userId: string;
  platform: PlatformType;
  credentials?: {
    username?: string;
    email?: string;
    // Store encrypted tokens/cookies here
    accessToken?: string;
    refreshToken?: string;
  };
  isActive: boolean;
  lastSync?: Date;
  metadata?: Record<string, any>; // Platform-specific settings
  createdAt: Date;
  updatedAt: Date;
}

// Job posting information
export interface Job {
  _id?: ObjectId;
  id?: string;
  userId: string;
  platform: PlatformType;
  platformJobId: string; // External job ID from Seek/LinkedIn

  // Job details
  title: string;
  company: string;
  location?: string;
  salary?: string;
  description?: string;
  url?: string;

  // Job metadata
  postedDate?: Date;
  closingDate?: Date;
  jobType?: string; // full-time, part-time, contract, etc.
  workMode?: string; // remote, hybrid, onsite

  // Tracking
  status: ApplicationStatus;
  firstSeenAt: Date;
  lastUpdatedAt: Date;

  // Raw data from platform
  rawData?: Record<string, any>;
}

// Application history for each job
export interface JobApplication {
  _id?: ObjectId;
  id?: string;
  userId: string;
  jobId: string; // Reference to Job._id
  platform: PlatformType;

  // Application details
  appliedAt?: Date;
  status: ApplicationStatus;

  // API interactions
  apiCalls: ApiCallRecord[];

  // Generated content
  coverLetter?: string;
  tailoredResume?: string;
  questionAnswers?: Array<{
    question: string;
    answer: string;
  }>;

  // Bot interaction logs
  automationLogs?: Array<{
    timestamp: Date;
    action: string;
    success: boolean;
    message?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

// Individual API call record
export interface ApiCallRecord {
  timestamp: Date;
  endpoint: string; // /api/cover_letter, /api/resume, etc.
  aiProvider: string; // deepseek, claude, gemini

  // Request data
  request: {
    prompt?: string;
    jobDetails?: any;
    resumeText?: string;
    additionalData?: any;
  };

  // Response data
  response: {
    success: boolean;
    data?: any;
    error?: string;
  };

  // Usage tracking
  tokensUsed?: number;
  cost?: number;
  processingTime?: number; // milliseconds
}

export class JobService {
  // Platform Management
  async createPlatform(platformData: Omit<UserPlatform, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<UserPlatform> {
    const db = await connectToDatabase();

    const platform: Omit<UserPlatform, '_id' | 'id'> = {
      ...platformData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('user_platforms').insertOne(platform);

    return {
      ...platform,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async getUserPlatforms(userId: string): Promise<UserPlatform[]> {
    const db = await connectToDatabase();
    const platforms = await db.collection('user_platforms').find({ userId }).toArray();

    return platforms.map(p => ({
      ...p,
      id: p._id.toString()
    })) as UserPlatform[];
  }

  async updatePlatform(id: string, updates: Partial<UserPlatform>): Promise<UserPlatform | null> {
    const db = await connectToDatabase();

    const { _id, id: platformId, ...updateData } = updates as any;
    updateData.updatedAt = new Date();

    const result = await db.collection('user_platforms').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      id: result._id.toString()
    } as UserPlatform;
  }

  // Job Management
  async createJob(jobData: Omit<Job, '_id' | 'id' | 'firstSeenAt' | 'lastUpdatedAt'>): Promise<Job> {
    const db = await connectToDatabase();

    const job: Omit<Job, '_id' | 'id'> = {
      ...jobData,
      firstSeenAt: new Date(),
      lastUpdatedAt: new Date()
    };

    const result = await db.collection('jobs').insertOne(job);

    return {
      ...job,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async findJobByPlatformId(userId: string, platform: PlatformType, platformJobId: string): Promise<Job | null> {
    const db = await connectToDatabase();
    const job = await db.collection('jobs').findOne({ userId, platform, platformJobId });

    if (!job) return null;

    return {
      ...job,
      id: job._id.toString()
    } as Job;
  }

  async getUserJobs(userId: string, filters?: { platform?: PlatformType; status?: ApplicationStatus }): Promise<Job[]> {
    const db = await connectToDatabase();

    const query: any = { userId };
    if (filters?.platform) query.platform = filters.platform;
    if (filters?.status) query.status = filters.status;

    const jobs = await db.collection('jobs')
      .find(query)
      .sort({ lastUpdatedAt: -1 })
      .toArray();

    return jobs.map(j => ({
      ...j,
      id: j._id.toString()
    })) as Job[];
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
    const db = await connectToDatabase();

    const { _id, id: jobId, ...updateData } = updates as any;
    updateData.lastUpdatedAt = new Date();

    const result = await db.collection('jobs').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      id: result._id.toString()
    } as Job;
  }

  // Application Management
  async createApplication(appData: Omit<JobApplication, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<JobApplication> {
    const db = await connectToDatabase();

    const application: Omit<JobApplication, '_id' | 'id'> = {
      ...appData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('job_applications').insertOne(application);

    return {
      ...application,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async getJobApplication(jobId: string): Promise<JobApplication | null> {
    const db = await connectToDatabase();
    const app = await db.collection('job_applications').findOne({ jobId });

    if (!app) return null;

    return {
      ...app,
      id: app._id.toString()
    } as JobApplication;
  }

  async addApiCall(jobId: string, apiCall: ApiCallRecord): Promise<boolean> {
    const db = await connectToDatabase();

    const result = await db.collection('job_applications').updateOne(
      { jobId },
      {
        $push: { apiCalls: apiCall },
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  async addAutomationLog(jobId: string, log: { action: string; success: boolean; message?: string }): Promise<boolean> {
    const db = await connectToDatabase();

    const logEntry = {
      timestamp: new Date(),
      ...log
    };

    const result = await db.collection('job_applications').updateOne(
      { jobId },
      {
        $push: { automationLogs: logEntry },
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  async updateApplication(jobId: string, updates: Partial<JobApplication>): Promise<JobApplication | null> {
    const db = await connectToDatabase();

    const { _id, id, ...updateData } = updates as any;
    updateData.updatedAt = new Date();

    const result = await db.collection('job_applications').findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      id: result._id.toString()
    } as JobApplication;
  }

  // Analytics
  async getUserStats(userId: string): Promise<{
    totalJobs: number;
    byPlatform: Record<PlatformType, number>;
    byStatus: Record<ApplicationStatus, number>;
    totalApplications: number;
    totalApiCalls: number;
  }> {
    const db = await connectToDatabase();

    const jobs = await db.collection('jobs').find({ userId }).toArray();
    const applications = await db.collection('job_applications').find({ userId }).toArray();

    const byPlatform: any = {};
    const byStatus: any = {};

    jobs.forEach(job => {
      byPlatform[job.platform] = (byPlatform[job.platform] || 0) + 1;
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    });

    const totalApiCalls = applications.reduce((sum, app: any) => {
      return sum + (app.apiCalls?.length || 0);
    }, 0);

    return {
      totalJobs: jobs.length,
      byPlatform,
      byStatus,
      totalApplications: applications.length,
      totalApiCalls
    };
  }
}

// Export singleton
export const jobService = new JobService();
