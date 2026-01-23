# 🔐 RBAC API Documentation

Complete API documentation for the Role-Based Access Control system.

---

## 📋 Table of Contents

1. [Department Management](#department-management)
2. [Role Management](#role-management)
3. [User Role Assignment](#user-role-assignment)
4. [Agent Management](#agent-management)
5. [Agent-Job Seeker Relationships](#agent-job-seeker-relationships)

---

## 🏢 Department Management

### List All Departments

**Endpoint**: `GET /api/departments`

**Authentication**: Required (any authenticated user)

**Query Parameters**:
- `includeInactive` (optional): `true` to include inactive departments

**Response**:
```json
{
  "success": true,
  "departments": [
    {
      "id": "dept_id",
      "name": "Engineering",
      "code": "ENG",
      "description": "Engineering department",
      "parentDepartmentId": null,
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### Get Single Department

**Endpoint**: `GET /api/departments/:id`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "department": {
    "id": "dept_id",
    "name": "Engineering",
    "code": "ENG",
    "description": "Engineering department",
    "parentDepartmentId": null,
    "isActive": true,
    "children": [
      {
        "id": "child_dept_id",
        "name": "Frontend",
        "code": "FE"
      }
    ],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### Create Department

**Endpoint**: `POST /api/departments`

**Authentication**: Required (admin role or `departments:create` permission)

**Request Body**:
```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Engineering department",
  "parentDepartmentId": null
}
```

**Response**:
```json
{
  "success": true,
  "department": {
    "id": "dept_id",
    "name": "Engineering",
    "code": "ENG",
    "description": "Engineering department",
    "parentDepartmentId": null,
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### Update Department

**Endpoint**: `PUT /api/departments/:id`

**Authentication**: Required (admin role or `departments:update` permission)

**Request Body**:
```json
{
  "name": "Engineering Updated",
  "code": "ENG",
  "description": "Updated description",
  "parentDepartmentId": "parent_dept_id",
  "isActive": true
}
```

**Response**:
```json
{
  "success": true,
  "department": {
    "id": "dept_id",
    "name": "Engineering Updated",
    "code": "ENG",
    "description": "Updated description",
    "parentDepartmentId": "parent_dept_id",
    "isActive": true,
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

### Delete Department

**Endpoint**: `DELETE /api/departments/:id`

**Authentication**: Required (admin role or `departments:delete` permission)

**Response**:
```json
{
  "success": true,
  "message": "Department deleted successfully"
}
```

**Note**: Soft delete - sets `isActive: false`. Cannot delete if department has child departments.

---

## 👤 Role Management

### List All Roles

**Endpoint**: `GET /api/roles`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "roles": [
    {
      "id": "role_id",
      "name": "agent",
      "displayName": "Agent/Agency",
      "description": "Agency that can apply for jobs on behalf of job seekers",
      "permissions": [
        {
          "resource": "jobs",
          "action": "read",
          "scope": "all"
        },
        {
          "resource": "jobs",
          "action": "apply",
          "scope": "all"
        }
      ],
      "isSystemRole": true,
      "departmentSpecific": false,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### Create Custom Role

**Endpoint**: `POST /api/roles`

**Authentication**: Required (super_admin role only)

**Request Body**:
```json
{
  "name": "custom_role",
  "displayName": "Custom Role",
  "description": "A custom role with specific permissions",
  "permissions": [
    {
      "resource": "jobs",
      "action": "read",
      "scope": "department"
    },
    {
      "resource": "applications",
      "action": "create",
      "scope": "own"
    }
  ],
  "departmentSpecific": true
}
```

**Response**:
```json
{
  "success": true,
  "role": {
    "id": "role_id",
    "name": "custom_role",
    "displayName": "Custom Role",
    "description": "A custom role with specific permissions",
    "permissions": [...],
    "isSystemRole": false,
    "departmentSpecific": true,
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 👥 User Role Assignment

### Get User's Roles

**Endpoint**: `GET /api/users/:id/roles`

**Authentication**: Required (users can view their own roles, or admin permission required)

**Response**:
```json
{
  "success": true,
  "userId": "user_id",
  "roles": [
    {
      "role": "job_seeker",
      "departmentId": "dept_id",
      "grantedBy": "admin_user_id",
      "grantedAt": "2025-01-15T10:00:00.000Z",
      "expiresAt": null,
      "isActive": true
    },
    {
      "role": "agent",
      "departmentId": null,
      "grantedBy": "user_id",
      "grantedAt": "2025-01-15T11:00:00.000Z",
      "expiresAt": null,
      "isActive": true
    }
  ]
}
```

---

### Assign Role to User

**Endpoint**: `POST /api/users/:id/roles`

**Authentication**: Required (admin role or `roles:assign` permission)

**Request Body**:
```json
{
  "role": "agent",
  "departmentId": "dept_id",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "roleAssignment": {
    "role": "agent",
    "departmentId": "dept_id",
    "grantedBy": "admin_user_id",
    "grantedAt": "2025-01-15T10:00:00.000Z",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "isActive": true
  }
}
```

---

### Remove Role from User

**Endpoint**: `DELETE /api/users/:id/roles`

**Authentication**: Required (admin role or `roles:assign` permission)

**Request Body**:
```json
{
  "role": "agent",
  "departmentId": "dept_id"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Role removed successfully"
}
```

---

## 🤝 Agent Management

### Register as Agent

**Endpoint**: `POST /api/agents/register`

**Authentication**: Required

**Request Body**:
```json
{
  "agencyName": "ABC Recruitment Agency",
  "licenseNumber": "LIC123456",
  "contactEmail": "contact@abcagency.com",
  "contactPhone": "+1234567890",
  "commissionRate": 15,
  "fixedFee": 10,
  "billingMethod": "hybrid"
}
```

**Billing Methods**:
- `percentage` - Charge percentage of base cost (requires `commissionRate`)
- `fixed` - Charge fixed fee per application (requires `fixedFee`)
- `hybrid` - Charge both percentage and fixed fee (requires both)

**Response**:
```json
{
  "success": true,
  "message": "Agent registration successful",
  "agent": {
    "id": "agent_id",
    "agencyName": "ABC Recruitment Agency",
    "commissionRate": 15,
    "billingMethod": "hybrid",
    "isActive": true
  }
}
```

---

### Get Own Agent Profile

**Endpoint**: `GET /api/agents/register`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "agent": {
    "id": "agent_id",
    "agencyName": "ABC Recruitment Agency",
    "licenseNumber": "LIC123456",
    "contactEmail": "contact@abcagency.com",
    "contactPhone": "+1234567890",
    "isActive": true,
    "commissionRate": 15,
    "fixedFee": 10,
    "billingMethod": "hybrid",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## 🔗 Agent-Job Seeker Relationships

### Link Job Seeker to Agent

**Endpoint**: `POST /api/agents/job-seekers`

**Authentication**: Required (agent role)

**Request Body**:
```json
{
  "jobSeekerId": "user_id",
  "contractTerms": {
    "commissionRate": 20,
    "fixedFee": 15,
    "maxApplications": 100,
    "expiresAt": "2025-12-31T23:59:59.000Z"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Job seeker linked to agent successfully",
  "relationship": {
    "id": "relationship_id",
    "agentId": "agent_id",
    "jobSeekerId": "user_id",
    "status": "active",
    "contractTerms": {
      "commissionRate": 20,
      "fixedFee": 15,
      "maxApplications": 100,
      "expiresAt": "2025-12-31T23:59:59.000Z"
    }
  }
}
```

---

### Get Agent's Job Seekers

**Endpoint**: `GET /api/agents/job-seekers`

**Authentication**: Required (agent role)

**Response**:
```json
{
  "success": true,
  "jobSeekers": [
    {
      "relationshipId": "relationship_id",
      "jobSeeker": {
        "id": "user_id",
        "email": "jobseeker@example.com",
        "name": "John Doe"
      },
      "status": "active",
      "contractTerms": {
        "commissionRate": 20,
        "fixedFee": 15,
        "maxApplications": 100
      },
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## 🔐 Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

To get a JWT token:
1. Login: `POST /api/auth/login` → get session token
2. Convert to JWT: `POST /api/auth/session-to-jwt` → get JWT access token

---

## 📝 Permission Reference

### Department Permissions
- `departments:create` - Create departments
- `departments:read` - View departments
- `departments:update` - Update departments
- `departments:delete` - Delete departments

### Role Permissions
- `roles:assign` - Assign roles to users
- `roles:read` - View roles

### User Permissions
- `users:read` - View user information
- `users:manage` - Manage users

---

## 🎯 Example Workflows

### Workflow 1: Register as Agent and Link Job Seeker

```bash
# 1. Register as agent
POST /api/agents/register
{
  "agencyName": "My Agency",
  "commissionRate": 15,
  "billingMethod": "percentage"
}

# 2. Link a job seeker
POST /api/agents/job-seekers
{
  "jobSeekerId": "user_123",
  "contractTerms": {
    "commissionRate": 20
  }
}

# 3. Submit application on behalf
POST /api/agent/applications
{
  "jobId": "job_456",
  "jobSeekerId": "user_123",
  "applicationData": {
    "coverLetter": "...",
    "resume": "..."
  }
}
```

### Workflow 2: Create Department and Assign Users

```bash
# 1. Create department
POST /api/departments
{
  "name": "Sales",
  "code": "SALES"
}

# 2. Assign role to user in department
POST /api/users/user_123/roles
{
  "role": "admin",
  "departmentId": "sales_dept_id"
}
```

---

## ⚠️ Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (permission denied)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

---

## 🧪 Testing

Use the verification script to check system status:

```bash
npm run verify-rbac
```

This will show:
- All roles and their permissions
- All departments
- All users and their roles
- All registered agents

---

## 📚 Related Documentation

- `AUTHENTICATION_ARCHITECTURE.md` - Complete system architecture
- `RBAC_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `RBAC_NEXT_STEPS.md` - Usage examples and next steps
