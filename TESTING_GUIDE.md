# 🧪 Testing Guide - RBAC System

## Quick Start: Create Test Users

### Step 1: Seed RBAC System
```bash
npm run seed-rbac
```

### Step 2: Create Test Users
```bash
npm run create-test-users
```

This will create 8 test users with different roles:

| Email | Password | Roles | Department | Notes |
|-------|----------|-------|------------|-------|
| `superadmin@test.com` | `password123` | super_admin | DEFAULT | Full system access |
| `admin@test.com` | `password123` | admin | ENG | Department admin |
| `agent1@test.com` | `password123` | agent, job_seeker | DEFAULT | Has agent profile |
| `jobseeker1@test.com` | `password123` | job_seeker | DEFAULT | Regular user |
| `jobseeker2@test.com` | `password123` | job_seeker | DEFAULT | Premium user |
| `billing@test.com` | `password123` | billing_manager | FIN | Finance dept |
| `hr@test.com` | `password123` | hr_manager | HR | HR department |
| `viewer@test.com` | `password123` | viewer | ENG | Read-only access |

---

## 🔐 Testing Authentication Flow

### 1. Login as Different Users

#### Super Admin
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@test.com","password":"password123"}'

# Response includes session_token
# Use this token to access admin endpoints
```

#### Agent
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent1@test.com","password":"password123"}'

# Convert to JWT
curl -X POST http://localhost:3000/api/auth/session-to-jwt \
  -H "Authorization: Bearer <session_token>"

# Use JWT token for agent endpoints
```

#### Job Seeker
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jobseeker1@test.com","password":"password123"}'
```

---

## 🧪 Test Scenarios

### Scenario 1: Super Admin Access

**Test**: Super admin should access all endpoints

```bash
# 1. Login as superadmin
# 2. Convert to JWT
# 3. Test admin endpoints

curl -X GET http://localhost:3000/api/admin/system \
  -H "Authorization: Bearer <jwt_token>"

curl -X GET http://localhost:3000/api/roles \
  -H "Authorization: Bearer <jwt_token>"

curl -X GET http://localhost:3000/api/departments \
  -H "Authorization: Bearer <jwt_token>"
```

**Expected**: All endpoints return 200 OK

---

### Scenario 2: Department Admin Access

**Test**: Department admin can only manage their department

```bash
# 1. Login as admin@test.com (ENG department)
# 2. Convert to JWT
# 3. Try to access other departments

curl -X GET http://localhost:3000/api/departments \
  -H "Authorization: Bearer <jwt_token>"

# Should only see ENG department or get permission denied
```

**Expected**: Limited access to own department

---

### Scenario 3: Agent Registration & Application

**Test**: Agent can register and submit applications

```bash
# 1. Login as agent1@test.com
# 2. Check agent profile
curl -X GET http://localhost:3000/api/agents/register \
  -H "Authorization: Bearer <jwt_token>"

# 3. Link a job seeker
curl -X POST http://localhost:3000/api/agents/job-seekers \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobSeekerId": "<jobseeker1_user_id>",
    "contractTerms": {
      "commissionRate": 20
    }
  }'

# 4. Submit application on behalf
curl -X POST http://localhost:3000/api/agent/applications \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "<job_id>",
    "jobSeekerId": "<jobseeker1_user_id>",
    "applicationData": {
      "coverLetter": "Test cover letter",
      "resume": "Test resume"
    }
  }'
```

**Expected**: 
- Agent profile exists
- Can link job seekers
- Can submit applications
- Job seeker is charged automatically

---

### Scenario 4: Permission Checks

**Test**: Users can only access endpoints they have permission for

```bash
# 1. Login as jobseeker1@test.com
# 2. Try to access admin endpoint
curl -X GET http://localhost:3000/api/admin/system \
  -H "Authorization: Bearer <jwt_token>"

# Expected: 403 Forbidden

# 3. Try to apply for job (should work)
curl -X POST http://localhost:3000/api/jobs/apply \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "...", "coverLetter": "..."}'

# Expected: 200 OK (if has jobs:apply permission)
```

---

### Scenario 5: Role Assignment

**Test**: Admin can assign roles to users

```bash
# 1. Login as superadmin
# 2. Assign role to user
curl -X POST http://localhost:3000/api/users/<user_id>/roles \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "agent",
    "departmentId": null
  }'

# 3. Verify role assignment
curl -X GET http://localhost:3000/api/users/<user_id>/roles \
  -H "Authorization: Bearer <jwt_token>"
```

**Expected**: Role assigned successfully

---

## 🎯 Frontend Testing

### 1. Access RBAC Management Page

1. Login as `superadmin@test.com` / `password123`
2. Navigate to `/admin/rbac`
3. Should see:
   - All roles listed
   - All departments listed
   - All users with their roles

### 2. Assign Role to User

1. Go to "User Assignments" tab
2. Click "Assign Role" on any user
3. Select role and department
4. Submit
5. Verify role appears in user's roles

### 3. View Audit Logs

1. Navigate to `/admin/audit-logs`
2. Should see all actions logged
3. Filter by user, action, date range

### 4. View Analytics

1. Navigate to `/admin/analytics`
2. Should see:
   - User statistics
   - Role distribution
   - Department distribution
   - Activity tracking

---

## 🔍 Verification Commands

### Check System Status
```bash
npm run verify-rbac
```

### Check User Roles
```bash
# In MongoDB shell or via API
GET /api/users/<user_id>/roles
```

### Check Permissions
```bash
POST /api/utils/permissions
{
  "resource": "jobs",
  "action": "apply",
  "userId": "<user_id>"
}
```

---

## 📝 Test Checklist

- [ ] Super admin can access all endpoints
- [ ] Department admin can only access own department
- [ ] Agent can register and view profile
- [ ] Agent can link job seekers
- [ ] Agent can submit applications (charges job seeker)
- [ ] Job seeker can view charges from agents
- [ ] Role assignment works
- [ ] Permission checks work
- [ ] Department isolation works
- [ ] Audit logs capture all actions
- [ ] Analytics show correct data
- [ ] Frontend pages load correctly
- [ ] JWT tokens include RBAC data

---

## 🐛 Troubleshooting

### Issue: 401 Unauthorized
**Solution**: Make sure you're using JWT tokens, not session tokens. Convert session token to JWT first.

### Issue: 403 Forbidden
**Solution**: User doesn't have required role/permission. Check user's roles and permissions.

### Issue: Roles not showing
**Solution**: Run `npm run seed-rbac` to create roles, then `npm run migrate-rbac` to assign roles to users.

### Issue: Frontend can't load data
**Solution**: Check browser console for errors. Make sure JWT token is being used, not session token.

---

## 🎉 Success Criteria

✅ All test users created successfully  
✅ Each user has correct roles assigned  
✅ Permissions work as expected  
✅ Department isolation works  
✅ Agent system functions correctly  
✅ Frontend pages load and function  
✅ Audit logs capture actions  
✅ Analytics show correct data  

---

## 📚 Next Steps

After testing:
1. Create additional departments as needed
2. Assign custom roles to users
3. Test agent application flow end-to-end
4. Verify billing/charging works
5. Test refund functionality
6. Verify audit logging

Happy testing! 🚀
