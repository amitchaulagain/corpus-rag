// JSON-based User Storage (temporary until MongoDB is ready)
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const USERS_FILE = './data/users.json';
const SESSIONS_FILE = './data/sessions.json';
const USAGE_FILE = './data/usage.json';

export type UserType = 'admin' | 'premium' | 'freetier';

export interface User {
  id: string;
  email: string;
  googleId?: string;
  name: string;
  picture?: string;
  userType: UserType;
  isPaid: boolean;
  apiPermissions: {
    cover_letter: boolean;
    resume: boolean;
    questionAndAnswers: boolean;
    upload: boolean;
    jobs: boolean;
  };
  createdAt: string;
  lastLogin: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  endpoint: string;
  jobId?: string;
  aiProvider: string;
  tokensUsed: number;
  costUsd: number;
  success: boolean;
  timestamp: string;
}

class UserStorage {
  async ensureDataDir() {
    try {
      await fs.mkdir('./data', { recursive: true });
    } catch (error) {
      // Directory exists, ignore
    }
  }

  async loadUsers(): Promise<User[]> {
    await this.ensureDataDir();
    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveUsers(users: User[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  }

  async loadSessions(): Promise<Session[]> {
    await this.ensureDataDir();
    try {
      const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveSessions(sessions: Session[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }

  async loadUsage(): Promise<UsageRecord[]> {
    await this.ensureDataDir();
    try {
      const data = await fs.readFile(USAGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveUsage(usage: UsageRecord[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2));
  }

  // User operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'lastLogin'>): Promise<User> {
    const users = await this.loadUsers();
    const user: User = {
      ...userData,
      id: randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    users.push(user);
    await this.saveUsers(users);
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.email === email) || null;
  }

  async findUserById(id: string): Promise<User | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.id === id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const users = await this.loadUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    users[index] = { ...users[index], ...updates };
    await this.saveUsers(users);
    return users[index];
  }

  async deleteUser(id: string): Promise<boolean> {
    const users = await this.loadUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return false;

    await this.saveUsers(filtered);
    return true;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.loadUsers();
  }

  // Session operations
  async createSession(userId: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): Promise<Session> {
    const sessions = await this.loadSessions();
    const session: Session = {
      id: randomBytes(16).toString('hex'),
      userId,
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      createdAt: new Date().toISOString()
    };
    sessions.push(session);
    await this.saveSessions(sessions);
    return session;
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    const sessions = await this.loadSessions();
    const session = sessions.find((s) => s.token === token);

    if (!session) return null;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.deleteSession(token);
      return null;
    }

    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const sessions = await this.loadSessions();
    const filtered = sessions.filter((s) => s.token !== token);
    if (filtered.length === sessions.length) return false;

    await this.saveSessions(filtered);
    return true;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const sessions = await this.loadSessions();
    const filtered = sessions.filter((s) => s.userId !== userId);
    await this.saveSessions(filtered);
  }

  // Usage tracking
  async trackUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<UsageRecord> {
    const usage = await this.loadUsage();
    const usageRecord: UsageRecord = {
      ...record,
      id: randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString()
    };
    usage.push(usageRecord);
    await this.saveUsage(usage);
    return usageRecord;
  }

  async getUserUsage(userId: string): Promise<UsageRecord[]> {
    const usage = await this.loadUsage();
    return usage.filter((u) => u.userId === userId);
  }

  // Get default permissions based on user type
  static getDefaultPermissions(userType: UserType) {
    switch (userType) {
      case 'admin':
        return {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        };
      case 'premium':
        return {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        };
      case 'freetier':
        return {
          cover_letter: true,
          resume: false,
          questionAndAnswers: false,
          upload: true,
          jobs: true
        };
    }
  }
}

export const userStorage = new UserStorage();
