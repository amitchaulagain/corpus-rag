# 🔐 Enhanced Authentication & Authorization Architecture

## 📋 Overview

This document outlines a comprehensive, flexible, scalable, and loosely coupled authentication and authorization system that supports:
1. **Role-Based Access Control (RBAC)** with fine-grained permissions
2. **Agent/Agency System** - Agencies can apply for jobs on behalf of job seekers
3. **Department-Based Access Control** - Restricted access across departments
4. **Multi-tenant Architecture** - Support for different user types and relationships

---

## 🏗️ Architecture Principles

### Design Goals
1. **Flexible**: Easy to add new roles, permissions, and departments
2. **Scalable**: MongoDB-based with efficient indexing, supports horizontal scaling
3. **Loosely Coupled**: Modular components that can evolve independently
4. **Secure**: Multi-layer security with JWT, role checks, and department restrictions
5. **Auditable**: Complete audit trail for all actions

### Technology Stack
- **Backend**: SvelteKit API routes
- **Database**: MongoDB with optimized indexes
- **Authentication**: JWT (Access + Refresh tokens)
- **Authorization**: Role-Based Access Control (RBAC)
- **Billing**: Token-based system with agent charging

---

## 📊 Core Concepts

### 1. User Types & Roles

#### User Types (Legacy - for backward compatibility)
- `admin` - System administrators
- `premium` - Paid users
- `freetier` - Free tier users

#### New Role System (Primary)
Roles are hierarchical and can be combined:

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | System super administrator | All permissions, can manage all departments |
| `admin` | Department administrator | Manage own department, assign roles |
| `agent` | Agency/Agent user | Apply for jobs on behalf of job seekers, charge fees |
| `job_seeker` | Regular job seeker | Apply for jobs, manage own applications |
| `viewer` | Read-only access | View-only permissions |
| `billing_manager` | Billing department | Manage payments, invoices, agent charges |
| `hr_manager` | HR department | Manage job postings, applications |
| `support` | Support team | Limited access for customer support |

### 2. Departments

Departments represent organizational units with restricted access:

```typescript
interface Department {
  _id: ObjectId;
  name: string;                    // e.g., "Engineering", "Sales", "HR"
  code: string;                    // Unique code: "ENG", "SALES", "HR"
  description?: string;
  parentDepartmentId?: ObjectId;   // For hierarchical departments
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Department Access Rules:**
- Users can belong to multiple departments
- Users can have different roles in different departments
- Super admins can access all departments
- Department admins can only manage their own department
- Regular users can only access their assigned departments

### 3. Permissions System

Fine-grained permissions organized by resource:

```typescript
interface Permission {
  resource: string;      // e.g., "jobs", "applications", "users", "billing"
  action: string;        // e.g., "create", "read", "update", "delete", "apply"
  scope?: string;        // e.g., "own", "department", "all"
}
```

**Permission Examples:**
- `jobs:create` - Create job postings
- `jobs:apply` - Apply for jobs
- `applications:read:own` - View own applications
- `applications:read:department` - View department applications
- `applications:read:all` - View all applications (admin only)
- `users:manage:department` - Manage users in own department
- `billing:view:own` - View own billing
- `billing:manage:all` - Manage all billing (billing manager)

### 4. Agent/Agency System

**Concept**: Agencies (agents) can apply for jobs on behalf of job seekers and charge fees.

```typescript
interface Agent {
  _id: ObjectId;
  userId: ObjectId;                 // Reference to User (agent user)
  agencyName: string;               // Agency/company name
  licenseNumber?: string;          // Business license if required
  isActive: boolean;
  commissionRate: number;           // Percentage charged per application (e.g., 15%)
  fixedFee?: number;                // Fixed fee per application (alternative to %)
  billingMethod: 'percentage' | 'fixed' | 'hybrid';
  createdAt: Date;
  updatedAt: Date;
}

interface AgentJobSeekerRelationship {
  _id: ObjectId;
  agentId: ObjectId;                // Agent/Agency
  jobSeekerId: ObjectId;            // Job seeker user
  status: 'active' | 'suspended' | 'terminated';
  contractTerms?: {
    commissionRate?: number;         // Override default agent rate
    fixedFee?: number;
    maxApplications?: number;       // Limit on applications
    expiresAt?: Date;                // Contract expiry
  };
  createdAt: Date;
  updatedAt: Date;
}

interface AgentApplication {
  _id: ObjectId;
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
    commissionRate?: number;         // Commission rate used
    fixedFee?: number;               // Fixed fee if applicable
    currency: string;                // e.g., "USD", "AUD"
    status: 'pending' | 'charged' | 'refunded';
    chargedAt?: Date;
  };
  status: 'pending' | 'submitted' | 'rejected' | 'accepted';
  submittedAt: Date;
  createdAt: Date;
}
```

---

## 🗄️ Database Schema

### Collections

#### 1. **users** (Extended)
```typescript
interface User {
  _id: ObjectId;
  email: string;
  name: string;
  password?: string;
  
  // Legacy fields (for backward compatibility)
  userType: 'admin' | 'premium' | 'freetier';
  isPaid: boolean;
  apiPermissions: ApiPermissions;
  
  // New RBAC fields
  roles: RoleAssignment[];           // Multiple roles across departments
  primaryDepartmentId?: ObjectId;    // Primary department
  departments: ObjectId[];           // All departments user belongs to
  
  // Agent fields (if user is an agent)
  agentProfile?: {
    agentId: ObjectId;               // Reference to agents collection
    isActive: boolean;
  };
  
  // Token Management
  tokenBalance?: number;
  totalTokensPurchased?: number;
  totalTokensUsed?: number;
  
  // Payment & Billing
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  
  createdAt: Date;
  lastLogin: Date;
}

interface RoleAssignment {
  role: string;                      // Role name
  departmentId?: ObjectId;            // null = system-wide role
  grantedBy: ObjectId;                // User who granted this role
  grantedAt: Date;
  expiresAt?: Date;                   // Optional expiry
  isActive: boolean;
}
```

#### 2. **departments** (New)
```typescript
interface Department {
  _id: ObjectId;
  name: string;
  code: string;                      // Unique, uppercase
  description?: string;
  parentDepartmentId?: ObjectId;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3. **roles** (New - Role definitions)
```typescript
interface Role {
  _id: ObjectId;
  name: string;                      // Unique role name
  displayName: string;
  description?: string;
  permissions: Permission[];        // Array of permissions
  isSystemRole: boolean;             // Cannot be deleted
  departmentSpecific: boolean;      // Can only be assigned within departments
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. **agents** (New)
```typescript
interface Agent {
  _id: ObjectId;
  userId: ObjectId;                  // User who is the agent
  agencyName: string;
  licenseNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  commissionRate: number;            // Default commission %
  fixedFee?: number;
  billingMethod: 'percentage' | 'fixed' | 'hybrid';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. **agent_job_seeker_relationships** (New)
```typescript
interface AgentJobSeekerRelationship {
  _id: ObjectId;
  agentId: ObjectId;
  jobSeekerId: ObjectId;
  status: 'active' | 'suspended' | 'terminated';
  contractTerms?: {
    commissionRate?: number;
    fixedFee?: number;
    maxApplications?: number;
    expiresAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 6. **agent_applications** (New)
```typescript
interface AgentApplication {
  _id: ObjectId;
  jobId: ObjectId;
  jobSeekerId: ObjectId;
  agentId: ObjectId;
  applicationData: {
    coverLetter: string;
    resume: string;
    answers?: Array<{ question: string; answer: string }>;
  };
  charges: {
    amount: number;
    commissionRate?: number;
    fixedFee?: number;
    currency: string;
    status: 'pending' | 'charged' | 'refunded';
    chargedAt?: Date;
    transactionId?: string;          // Payment transaction ID
  };
  status: 'pending' | 'submitted' | 'rejected' | 'accepted';
  submittedAt: Date;
  createdAt: Date;
}
```

#### 7. **permissions** (New - Permission definitions)
```typescript
interface Permission {
  _id: ObjectId;
  resource: string;                  // e.g., "jobs", "applications"
  action: string;                    // e.g., "create", "read", "update"
  scope?: string;                    // "own", "department", "all"
  description?: string;
  isSystemPermission: boolean;
  createdAt: Date;
}
```

---

## 🔒 Authentication Flow

### 1. Login Flow
```
User → POST /api/auth/login
  → Validate credentials
  → Create session (for web UI)
  → Return session token
```

### 2. JWT Token Flow
```
User → POST /api/auth/session-to-jwt
  → Validate session
  → Generate JWT access token (15 min) + refresh token (30 days)
  → Include roles, departments, permissions in JWT payload
  → Return tokens
```

### 3. JWT Payload Structure
```typescript
interface AccessTokenPayload {
  type: 'access';
  sub: string;                      // User ID
  email: string;
  roles: string[];                  // All active roles
  departments: string[];            // Department IDs
  primaryDepartment?: string;
  permissions: string[];             // Flattened permissions (resource:action:scope)
  isAgent: boolean;                 // Is user an agent
  agentId?: string;                 // Agent ID if applicable
  iat: number;
  exp: number;
}
```

---

## 🛡️ Authorization Middleware

### Middleware Stack
1. **Authentication Middleware** - Verify JWT token
2. **Role Check Middleware** - Verify user has required role
3. **Permission Check Middleware** - Verify user has required permission
4. **Department Check Middleware** - Verify user has access to department
5. **Resource Ownership Check** - Verify user owns resource or has access

### Usage Examples

```typescript
// Require authentication only
const auth = await requireAuth(event);

// Require specific role
const auth = await requireRole(event, 'agent');

// Require permission
const auth = await requirePermission(event, 'jobs:apply');

// Require permission with scope
const auth = await requirePermission(event, 'applications:read', 'department');

// Require department access
const auth = await requireDepartmentAccess(event, departmentId);

// Combined check
const auth = await requireAuth(event);
if (!hasPermission(auth.user, 'jobs:apply')) {
  throw error(403, 'Permission denied');
}
```

---

## 💰 Agent Billing System

### Flow: Agent Applies for Job on Behalf of Job Seeker

1. **Agent submits application**
   ```
   POST /api/agent/applications
   {
     jobId: "...",
     jobSeekerId: "...",
     applicationData: { ... }
   }
   ```

2. **System calculates charges**
   - Check agent's default commission rate or contract-specific rate
   - Calculate: `amount = (jobApplicationCost * commissionRate) + fixedFee`
   - Create pending charge record

3. **Charge job seeker**
   - Deduct from job seeker's token balance OR
   - Charge to job seeker's payment method
   - Update charge status to 'charged'

4. **Track application**
   - Create agent_application record
   - Link to original job application
   - Record billing transaction

### Billing Endpoints

- `POST /api/agent/applications` - Submit application (charges job seeker)
- `GET /api/agent/applications` - List agent's applications
- `GET /api/agent/charges` - View charges and commissions
- `GET /api/job-seekers/agent-charges` - Job seeker view of charges
- `POST /api/billing/pay-agent-charge` - Pay pending charge

---

## 📝 Implementation Plan

### Phase 1: Core RBAC System
1. ✅ Create roles collection and model
2. ✅ Create permissions collection and model
3. ✅ Create departments collection and model
4. ✅ Update user model with roles and departments
5. ✅ Create RBAC middleware functions
6. ✅ Update JWT payload to include roles/permissions

### Phase 2: Agent System
1. ✅ Create agents collection and model
2. ✅ Create agent_job_seeker_relationships collection
3. ✅ Create agent_applications collection
4. ✅ Implement agent application endpoints
5. ✅ Implement billing/charging logic

### Phase 3: Department Access Control
1. ✅ Implement department-based access checks
2. ✅ Update all endpoints with department restrictions
3. ✅ Create department management endpoints

### Phase 4: Migration & Backward Compatibility
1. ✅ Migrate existing users to new role system
2. ✅ Maintain backward compatibility with userType
3. ✅ Update all existing endpoints

---

## 🔄 Migration Strategy

### Existing Users Migration
1. Map `userType: 'admin'` → `roles: [{ role: 'super_admin', departmentId: null }]`
2. Map `userType: 'premium'` → `roles: [{ role: 'job_seeker', departmentId: null }]`
3. Map `userType: 'freetier'` → `roles: [{ role: 'job_seeker', departmentId: null }]`
4. Preserve `apiPermissions` for backward compatibility
5. Create default department if none exists

### Backward Compatibility
- Keep `userType` field for legacy code
- Keep `apiPermissions` field for legacy code
- New code should use RBAC system
- Gradual migration of endpoints

---

## 🧪 Testing Strategy

1. **Unit Tests**: Test each middleware function
2. **Integration Tests**: Test complete auth flows
3. **Permission Tests**: Test all permission combinations
4. **Department Tests**: Test department isolation
5. **Agent Tests**: Test agent application and billing flows

---

## 📚 API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Signup
- `POST /api/auth/session-to-jwt` - Get JWT tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Roles & Permissions
- `GET /api/roles` - List all roles
- `GET /api/permissions` - List all permissions
- `POST /api/users/:id/roles` - Assign role to user
- `DELETE /api/users/:id/roles/:roleId` - Remove role from user

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `PUT /api/departments/:id` - Update department
- `POST /api/users/:id/departments` - Add user to department

### Agents
- `POST /api/agents/register` - Register as agent
- `GET /api/agents/me` - Get own agent profile
- `POST /api/agents/job-seekers` - Link job seeker
- `POST /api/agent/applications` - Submit application on behalf
- `GET /api/agent/applications` - List agent applications
- `GET /api/agent/charges` - View charges/commissions

### Job Seekers
- `GET /api/job-seekers/agents` - List linked agents
- `GET /api/job-seekers/agent-charges` - View charges from agents

---

## 🔐 Security Considerations

1. **JWT Security**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (30 days)
   - Secure token storage
   - Token rotation on refresh

2. **Permission Checks**
   - Always verify permissions server-side
   - Never trust client-side role/permission claims
   - Use middleware for consistent checks

3. **Department Isolation**
   - Enforce department boundaries strictly
   - Prevent cross-department data access
   - Audit all department access attempts

4. **Agent Security**
   - Verify agent-job seeker relationships
   - Validate agent permissions before applications
   - Secure billing transactions

5. **Audit Logging**
   - Log all authentication attempts
   - Log all permission checks
   - Log all department access
   - Log all agent actions

---

## 📈 Scalability Considerations

1. **Database Indexes**
   - Index on `users.roles.role`
   - Index on `users.departments`
   - Index on `agent_applications.agentId`
   - Index on `agent_applications.jobSeekerId`

2. **Caching**
   - Cache user roles/permissions in JWT
   - Cache department memberships
   - Cache permission definitions

3. **Performance**
   - Batch permission checks
   - Lazy load department data
   - Optimize JWT verification

---

This architecture provides a solid foundation for a flexible, scalable authentication and authorization system that supports your requirements for agents, departments, and role-based access control.
