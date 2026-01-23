// Create Test Users with Different Roles
import { getDB } from '../src/lib/db/mongodb.js';
import { UserModel } from '../src/lib/models/user.js';
import { RoleModel } from '../src/lib/models/role.js';
import { DepartmentModel } from '../src/lib/models/department.js';
import { AgentModel } from '../src/lib/models/agent.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

interface TestUser {
  email: string;
  name: string;
  password: string;
  userType: 'admin' | 'premium' | 'freetier';
  roles: string[];
  departmentCode?: string;
  isAgent?: boolean;
  agentConfig?: {
    agencyName: string;
    commissionRate: number;
    billingMethod: 'percentage' | 'fixed' | 'hybrid';
  };
}

const testUsers: TestUser[] = [
  {
    email: 'superadmin@test.com',
    name: 'Super Admin',
    password: 'password123',
    userType: 'admin',
    roles: ['super_admin']
  },
  {
    email: 'admin@test.com',
    name: 'Department Admin',
    password: 'password123',
    userType: 'admin',
    roles: ['admin'],
    departmentCode: 'ENG'
  },
  {
    email: 'agent1@test.com',
    name: 'Agent One',
    password: 'password123',
    userType: 'premium',
    roles: ['agent', 'job_seeker'],
    isAgent: true,
    agentConfig: {
      agencyName: 'Test Recruitment Agency',
      commissionRate: 15,
      billingMethod: 'percentage'
    }
  },
  {
    email: 'jobseeker1@test.com',
    name: 'Job Seeker One',
    password: 'password123',
    userType: 'freetier',
    roles: ['job_seeker']
  },
  {
    email: 'jobseeker2@test.com',
    name: 'Job Seeker Two',
    password: 'password123',
    userType: 'premium',
    roles: ['job_seeker']
  },
  {
    email: 'billing@test.com',
    name: 'Billing Manager',
    password: 'password123',
    userType: 'premium',
    roles: ['billing_manager'],
    departmentCode: 'FIN'
  },
  {
    email: 'hr@test.com',
    name: 'HR Manager',
    password: 'password123',
    userType: 'premium',
    roles: ['hr_manager'],
    departmentCode: 'HR'
  },
  {
    email: 'viewer@test.com',
    name: 'Viewer User',
    password: 'password123',
    userType: 'freetier',
    roles: ['viewer'],
    departmentCode: 'ENG'
  }
];

async function createTestUsers() {
  try {
    console.log('🧪 Creating test users with different roles...\n');
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);
    const agentModel = new AgentModel(db);

    // Get or create departments
    const departmentsMap: Record<string, ObjectId> = {};
    
    // Create departments if they don't exist
    const deptCodes = ['ENG', 'FIN', 'HR', 'SALES'];
    for (const code of deptCodes) {
      let dept = await departmentModel.findByCode(code);
      if (!dept) {
        dept = await departmentModel.create({
          name: code === 'ENG' ? 'Engineering' : code === 'FIN' ? 'Finance' : code === 'HR' ? 'Human Resources' : 'Sales',
          code,
          description: `${code} Department`,
          isActive: true
        });
        console.log(`✅ Created department: ${code}`);
      }
      departmentsMap[code] = dept._id!;
    }

    // Get default department
    let defaultDept = await departmentModel.findByCode('DEFAULT');
    if (!defaultDept) {
      defaultDept = await departmentModel.create({
        name: 'Default Department',
        code: 'DEFAULT',
        description: 'Default department',
        isActive: true
      });
    }
    departmentsMap['DEFAULT'] = defaultDept._id!;

    let created = 0;
    let skipped = 0;

    for (const testUser of testUsers) {
      // Check if user already exists
      const existing = await userModel.findByEmail(testUser.email);
      if (existing) {
        console.log(`⏭️  User ${testUser.email} already exists, skipping...`);
        skipped++;
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(testUser.password, SALT_ROUNDS);

      // Create user
      const user = await userModel.create({
        email: testUser.email,
        name: testUser.name,
        password: hashedPassword,
        userType: testUser.userType,
        isPaid: testUser.userType === 'premium' || testUser.userType === 'admin',
        apiPermissions: UserModel.getDefaultPermissions(testUser.userType),
        roles: [],
        departments: []
      });

      // Assign roles
      const departmentId = testUser.departmentCode 
        ? departmentsMap[testUser.departmentCode] 
        : departmentsMap['DEFAULT'];

      for (const roleName of testUser.roles) {
        const role = await roleModel.findByName(roleName);
        if (!role) {
          console.error(`❌ Role '${roleName}' not found, skipping for ${testUser.email}`);
          continue;
        }

        await userModel.assignRole(user._id!, {
          role: roleName,
          departmentId: role.departmentSpecific ? departmentId : null,
          grantedBy: user._id!,
          grantedAt: new Date(),
          isActive: true
        });
      }

      // Add to department
      await userModel.addDepartment(user._id!, departmentId);
      await userModel.setPrimaryDepartment(user._id!, departmentId);

      // Create agent profile if needed
      if (testUser.isAgent && testUser.agentConfig) {
        const agent = await agentModel.create({
          userId: user._id!,
          agencyName: testUser.agentConfig.agencyName,
          isActive: true,
          commissionRate: testUser.agentConfig.commissionRate,
          fixedFee: 0,
          billingMethod: testUser.agentConfig.billingMethod
        });

        await userModel.setAgentProfile(user._id!, agent._id!, true);
        console.log(`✅ Created agent profile for ${testUser.email}`);
      }

      console.log(`✅ Created user: ${testUser.email}`);
      console.log(`   - Roles: ${testUser.roles.join(', ')}`);
      console.log(`   - Department: ${testUser.departmentCode || 'DEFAULT'}`);
      console.log(`   - Password: ${testUser.password}`);
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`   • Created: ${created} users`);
    console.log(`   • Skipped: ${skipped} users`);
    console.log('\n✅ Test users created successfully!');
    console.log('\n📝 Test Users:');
    testUsers.forEach(u => {
      console.log(`   • ${u.email} (${u.password}) - Roles: ${u.roles.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUsers()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { createTestUsers };
