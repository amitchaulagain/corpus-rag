// Job Model with embedded application data
import { ObjectId, type Db } from 'mongodb';

export type PlatformType = 'seek' | 'linkedin' | 'indeed' | 'other';
export type ApplicationStatus = 'pending' | 'applied' | 'rejected' | 'interview' | 'offer' | 'withdrawn';

// API call record embedded in application
export interface ApiCallRecord {
  timestamp: Date;
  endpoint: string; // 'cover_letter', 'resume', 'questionAndAnswers'
  aiProvider: string; // 'deepseek-chat', 'claude-sonnet', 'gemini-flash'
  request: {
    prompt?: string;
    jobDetails?: any;
    resumeText?: string;
    additionalData?: any;
  };
  response: {
    success: boolean;
    data?: any;
    error?: string;
  };
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  processingTime?: number; // milliseconds
}

// Automation log embedded in application
export interface AutomationLog {
  timestamp: Date;
  action: string;
  success: boolean;
  message?: string;
}

// Application data embedded in Job
export interface Application {
  status: ApplicationStatus;
  appliedAt?: Date;
  coverLetter?: string;
  tailoredResume?: string;
  questionAnswers?: Array<{
    question: string;
    answer: string;
  }>;
  apiCalls: ApiCallRecord[];
  automationLogs: AutomationLog[];
  createdAt: Date;
  updatedAt: Date;
}

// Main Job document
export interface Job {
  _id?: ObjectId;
  userId: ObjectId;
  platform: PlatformType;
  platformJobId: string; // External job ID from platform

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
  jobType?: string; // 'full-time', 'part-time', 'contract', etc.
  workMode?: string; // 'remote', 'hybrid', 'onsite'

  // Extended job info (HR, requirements – from scraping or parsing)
  hrContact?: { name?: string; email?: string; phone?: string };
  requiredSkills?: string[];
  requiredExperience?: string;
  /** Extra fields from platform (e.g. posted, application_volume, category) */
  jobDetails?: Record<string, any>;

  // Status tracking
  status: ApplicationStatus;

  // Embedded application data (1-to-1 relationship)
  application?: Application;

  // Tracking
  firstSeenAt: Date;
  lastUpdatedAt: Date;

  // Raw data from platform
  rawData?: Record<string, any>;
}

export class JobModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(jobData: Omit<Job, '_id' | 'firstSeenAt' | 'lastUpdatedAt'>): Promise<Job> {
    const job: Job = {
      ...jobData,
      firstSeenAt: new Date(),
      lastUpdatedAt: new Date()
    };

    const result = await this.db.collection<Job>('jobs').insertOne(job);
    return { ...job, _id: result.insertedId };
  }

  async findById(id: string | ObjectId): Promise<Job | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<Job>('jobs').findOne({ _id: objectId });
  }

  async findByPlatformId(
    userId: string | ObjectId,
    platform: PlatformType,
    platformJobId: string
  ): Promise<Job | null> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await this.db.collection<Job>('jobs').findOne({
      userId: userObjectId,
      platform,
      platformJobId
    });
  }

  async findByUserId(
    userId: string | ObjectId,
    filters?: { platform?: PlatformType; status?: ApplicationStatus }
  ): Promise<Job[]> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const query: any = { userId: userObjectId };
    if (filters?.platform) query.platform = filters.platform;
    if (filters?.status) query.status = filters.status;

    return await this.db
      .collection<Job>('jobs')
      .find(query)
      .sort({ lastUpdatedAt: -1 })
      .toArray();
  }

  async update(id: string | ObjectId, updates: Partial<Job>): Promise<Job | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await this.db.collection<Job>('jobs').findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          ...updates,
          lastUpdatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.db.collection<Job>('jobs').deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  // Application management (embedded document)
  async createApplication(jobId: string | ObjectId, applicationData: Omit<Application, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    const objectId = typeof jobId === 'string' ? new ObjectId(jobId) : jobId;

    const application: Application = {
      ...applicationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<Job>('jobs').updateOne(
      { _id: objectId },
      {
        $set: {
          application,
          lastUpdatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async updateApplication(jobId: string | ObjectId, updates: Partial<Application>): Promise<boolean> {
    const objectId = typeof jobId === 'string' ? new ObjectId(jobId) : jobId;

    const setFields: any = { lastUpdatedAt: new Date() };
    Object.keys(updates).forEach(key => {
      setFields[`application.${key}`] = updates[key as keyof Application];
    });
    setFields['application.updatedAt'] = new Date();

    const result = await this.db.collection<Job>('jobs').updateOne(
      { _id: objectId },
      { $set: setFields }
    );

    return result.modifiedCount > 0;
  }

  async addApiCall(jobId: string | ObjectId, apiCall: ApiCallRecord): Promise<boolean> {
    const objectId = typeof jobId === 'string' ? new ObjectId(jobId) : jobId;

    const result = await this.db.collection<Job>('jobs').updateOne(
      { _id: objectId },
      {
        $push: { 'application.apiCalls': apiCall },
        $set: {
          'application.updatedAt': new Date(),
          lastUpdatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async addAutomationLog(jobId: string | ObjectId, log: Omit<AutomationLog, 'timestamp'>): Promise<boolean> {
    const objectId = typeof jobId === 'string' ? new ObjectId(jobId) : jobId;

    const logEntry: AutomationLog = {
      timestamp: new Date(),
      ...log
    };

    const result = await this.db.collection<Job>('jobs').updateOne(
      { _id: objectId },
      {
        $push: { 'application.automationLogs': logEntry },
        $set: {
          'application.updatedAt': new Date(),
          lastUpdatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Upsert a job application from an external client (e.g. finalboss Seek bot).
   * Idempotent by (userId, platform, platformJobId). Creates or updates one document.
   */
  async upsertJobApplication(
    userId: string | ObjectId,
    payload: {
      platform: PlatformType;
      platformJobId: string;
      title: string;
      company: string;
      url?: string;
      description?: string;
      location?: string;
      salary?: string;
      jobType?: string;
      workMode?: string;
      postedDate?: string;
      closingDate?: string;
      hrContact?: { name?: string; email?: string; phone?: string };
      requiredSkills?: string[];
      requiredExperience?: string;
      jobDetails?: Record<string, any>;
      application: {
        coverLetter?: string;
        tailoredResume?: string;
        questionAnswers?: Array<{ question: string; answer: string }>;
        apiCalls?: Array<Partial<ApiCallRecord> & { endpoint: string; timestamp?: Date | string }>;
      };
      rawData?: Record<string, any>;
    }
  ): Promise<{ job: Job; created: boolean }> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const now = new Date();

    const rawApiCalls = payload.application?.apiCalls ?? [];
    const apiCalls: ApiCallRecord[] = rawApiCalls.map((c) => ({
      timestamp: c.timestamp ? (c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)) : now,
      endpoint: c.endpoint,
      aiProvider: c.aiProvider ?? 'unknown',
      request: c.request ?? {},
      response: c.response ?? { success: true },
      tokensUsed: c.tokensUsed,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      cost: c.cost,
      processingTime: c.processingTime
    }));

    const application: Application = {
      status: 'applied',
      appliedAt: now,
      coverLetter: payload.application?.coverLetter ?? '',
      tailoredResume: payload.application?.tailoredResume ?? '',
      questionAnswers: payload.application?.questionAnswers ?? [],
      apiCalls,
      automationLogs: [],
      createdAt: now,
      updatedAt: now
    };

    const jobDoc: Omit<Job, '_id'> = {
      userId: userObjectId,
      platform: payload.platform,
      platformJobId: payload.platformJobId,
      title: payload.title,
      company: payload.company,
      url: payload.url,
      description: payload.description,
      location: payload.location,
      salary: payload.salary,
      jobType: payload.jobType,
      workMode: payload.workMode,
      postedDate: payload.postedDate ? new Date(payload.postedDate) : undefined,
      status: 'applied',
      application,
      firstSeenAt: now,
      lastUpdatedAt: now,
      ...(payload.rawData && Object.keys(payload.rawData).length > 0 ? { rawData: payload.rawData } : {})
    };

    const existing = await this.findByPlatformId(userObjectId, payload.platform, payload.platformJobId);

    if (existing && existing._id) {
      await this.db.collection<Job>('jobs').updateOne(
        { _id: existing._id },
        {
          $set: {
            title: jobDoc.title,
            company: jobDoc.company,
            url: jobDoc.url,
            description: jobDoc.description,
            location: jobDoc.location,
            salary: jobDoc.salary,
            jobType: jobDoc.jobType,
            workMode: jobDoc.workMode,
            postedDate: jobDoc.postedDate,
            closingDate: jobDoc.closingDate,
            hrContact: jobDoc.hrContact,
            requiredSkills: jobDoc.requiredSkills,
            requiredExperience: jobDoc.requiredExperience,
            jobDetails: jobDoc.jobDetails,
            status: jobDoc.status,
            application,
            lastUpdatedAt: now,
            ...(jobDoc.rawData ? { rawData: jobDoc.rawData } : {})
          }
        }
      );
      const updated = await this.findById(existing._id);
      return { job: updated!, created: false };
    }

    const result = await this.db.collection<Job>('jobs').insertOne(jobDoc as Job);
    return {
      job: { ...jobDoc, _id: result.insertedId } as Job,
      created: true
    };
  }

  // Analytics
  async getStats(userId: string | ObjectId): Promise<{
    totalJobs: number;
    byPlatform: Record<PlatformType, number>;
    byStatus: Record<ApplicationStatus, number>;
    totalApplications: number;
    totalApiCalls: number;
  }> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const jobs = await this.findByUserId(userObjectId);

    const byPlatform: any = {};
    const byStatus: any = {};
    let totalApplications = 0;
    let totalApiCalls = 0;

    jobs.forEach(job => {
      byPlatform[job.platform] = (byPlatform[job.platform] || 0) + 1;
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;

      if (job.application) {
        totalApplications++;
        totalApiCalls += job.application.apiCalls?.length || 0;
      }
    });

    return {
      totalJobs: jobs.length,
      byPlatform,
      byStatus,
      totalApplications,
      totalApiCalls
    };
  }
}
