// Generic Questions Model and Types
import { ObjectId, type Db } from 'mongodb';

export interface GenericQuestion {
  _id?: ObjectId;
  userId: ObjectId;
  questionId?: number;              // Original ID from finalboss (for migration)
  match_keywords: string[];
  answers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenericQuestionsSettings {
  _id?: ObjectId;
  userId: ObjectId;
  autoAnswer: boolean;
  lastUpdated: Date;
}

export class GenericQuestionsModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async getQuestionsByUserId(userId: ObjectId): Promise<GenericQuestion[]> {
    return await this.db
      .collection<GenericQuestion>('generic_questions')
      .find({ userId, isActive: true })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async getAllQuestionsByUserId(userId: ObjectId): Promise<GenericQuestion[]> {
    return await this.db
      .collection<GenericQuestion>('generic_questions')
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async getQuestionById(questionId: ObjectId, userId: ObjectId): Promise<GenericQuestion | null> {
    return await this.db
      .collection<GenericQuestion>('generic_questions')
      .findOne({ _id: questionId, userId });
  }

  async createQuestion(question: Omit<GenericQuestion, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .insertOne({
        ...question,
        createdAt: now,
        updatedAt: now
      });
    return result.insertedId;
  }

  async updateQuestion(questionId: ObjectId, userId: ObjectId, updates: Partial<GenericQuestion>): Promise<boolean> {
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .updateOne(
        { _id: questionId, userId },
        { $set: { ...updates, updatedAt: new Date() } }
      );
    return result.modifiedCount > 0;
  }

  async deleteQuestion(questionId: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .deleteOne({ _id: questionId, userId });
    return result.deletedCount > 0;
  }

  async getSettings(userId: ObjectId): Promise<GenericQuestionsSettings | null> {
    return await this.db
      .collection<GenericQuestionsSettings>('generic_questions_settings')
      .findOne({ userId });
  }

  async updateSettings(userId: ObjectId, settings: Partial<Omit<GenericQuestionsSettings, '_id' | 'userId' | 'lastUpdated'>>): Promise<void> {
    await this.db
      .collection<GenericQuestionsSettings>('generic_questions_settings')
      .updateOne(
        { userId },
        { 
          $set: { 
            ...settings, 
            userId,
            lastUpdated: new Date() 
          } 
        },
        { upsert: true }
      );
  }

  async syncQuestions(userId: ObjectId, questions: Array<{
    questionId?: number;
    match_keywords: string[];
    answers: string[];
  }>): Promise<void> {
    const now = new Date();
    
    // Delete existing questions for this user
    await this.db
      .collection<GenericQuestion>('generic_questions')
      .deleteMany({ userId });

    // Insert new questions
    if (questions.length > 0) {
      const questionsToInsert = questions
        .filter(q => q.match_keywords.length > 0 && q.answers.length > 0)
        .map(q => ({
          userId,
          questionId: q.questionId,
          match_keywords: q.match_keywords,
          answers: q.answers,
          isActive: true,
          createdAt: now,
          updatedAt: now
        }));

      if (questionsToInsert.length > 0) {
        await this.db
          .collection<GenericQuestion>('generic_questions')
          .insertMany(questionsToInsert);
      }
    }
  }
}
