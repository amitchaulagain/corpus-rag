// Seed RBAC System - Initial Roles and Permissions
import { getDB } from '../src/lib/db/mongodb.js';
import { RoleModel, type Permission } from '../src/lib/models/role.js';
import { DepartmentModel } from '../src/lib/models/department.js';

async function seedRBAC() {
  try {
    console.log('🌱 Seeding RBAC system...\n');
    
    const db = await getDB();
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);

    // ========================================
    // 1. Create Default Roles
    // ========================================
    console.log('📋 Creating roles...');

    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'System super administrator with all permissions',
        isSystemRole: true,
        departmentSpecific: false,
        permissions: [
          // All permissions
          { resource: '*', action: '*', scope: 'all' }
        ] as Permission[]
      },
      {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Department administrator with management permissions',
        isSystemRole: true,
        departmentSpecific: true,
        permissions: [
          { resource: 'users', action: 'read', scope: 'department' },
          { resource: 'users', action: 'update', scope: 'department' },
          { resource: 'users', action: 'manage', scope: 'department' },
          { resource: 'roles', action: 'assign', scope: 'department' },
          { resource: 'departments', action: 'read', scope: 'department' },
          { resource: 'departments', action: 'update', scope: 'department' },
          { resource: 'jobs', action: '*', scope: 'department' },
          { resource: 'applications', action: '*', scope: 'department' },
          { resource: 'billing', action: 'read', scope: 'department' }
        ] as Permission[]
      },
      {
        name: 'agent',
        displayName: 'Agent/Agency',
        description: 'Agency that can apply for jobs on behalf of job seekers',
        isSystemRole: true,
        departmentSpecific: false,
        permissions: [
          { resource: 'jobs', action: 'read', scope: 'all' },
          { resource: 'jobs', action: 'apply', scope: 'all' },
          { resource: 'applications', action: 'create', scope: 'all' },
          { resource: 'applications', action: 'read', scope: 'own' },
          { resource: 'job_seekers', action: 'read', scope: 'own' },
          { resource: 'billing', action: 'read', scope: 'own' },
          { resource: 'billing', action: 'charge', scope: 'own' }
        ] as Permission[]
      },
      {
        name: 'job_seeker',
        displayName: 'Job Seeker',
        description: 'Regular job seeker who can apply for jobs',
        isSystemRole: true,
        departmentSpecific: false,
        permissions: [
          { resource: 'jobs', action: 'read', scope: 'all' },
          { resource: 'jobs', action: 'apply', scope: 'all' },
          { resource: 'applications', action: 'create', scope: 'own' },
          { resource: 'applications', action: 'read', scope: 'own' },
          { resource: 'applications', action: 'update', scope: 'own' },
          { resource: 'billing', action: 'read', scope: 'own' },
          { resource: 'billing', action: 'pay', scope: 'own' },
          { resource: 'agents', action: 'read', scope: 'own' }
        ] as Permission[]
      },
      {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access',
        isSystemRole: true,
        departmentSpecific: true,
        permissions: [
          { resource: 'jobs', action: 'read', scope: 'department' },
          { resource: 'applications', action: 'read', scope: 'department' },
          { resource: 'users', action: 'read', scope: 'department' }
        ] as Permission[]
      },
      {
        name: 'billing_manager',
        displayName: 'Billing Manager',
        description: 'Manages billing, payments, and agent charges',
        isSystemRole: true,
        departmentSpecific: true,
        permissions: [
          { resource: 'billing', action: '*', scope: 'department' },
          { resource: 'billing', action: '*', scope: 'all' },
          { resource: 'agents', action: 'read', scope: 'department' },
          { resource: 'applications', action: 'read', scope: 'department' },
          { resource: 'orders', action: '*', scope: 'department' }
        ] as Permission[]
      },
      {
        name: 'hr_manager',
        displayName: 'HR Manager',
        description: 'Manages job postings and applications',
        isSystemRole: true,
        departmentSpecific: true,
        permissions: [
          { resource: 'jobs', action: '*', scope: 'department' },
          { resource: 'applications', action: '*', scope: 'department' },
          { resource: 'users', action: 'read', scope: 'department' }
        ] as Permission[]
      },
      {
        name: 'support',
        displayName: 'Support Team',
        description: 'Customer support with limited access',
        isSystemRole: true,
        departmentSpecific: false,
        permissions: [
          { resource: 'users', action: 'read', scope: 'own' },
          { resource: 'applications', action: 'read', scope: 'own' },
          { resource: 'jobs', action: 'read', scope: 'all' }
        ] as Permission[]
      }
    ];

    for (const roleData of roles) {
      const existing = await roleModel.findByName(roleData.name);
      if (existing) {
        console.log(`  ⏭️  Role '${roleData.name}' already exists, skipping...`);
      } else {
        await roleModel.create(roleData);
        console.log(`  ✅ Created role: ${roleData.displayName} (${roleData.name})`);
      }
    }

    // ========================================
    // 2. Create Default Department
    // ========================================
    console.log('\n🏢 Creating default department...');

    const defaultDept = await departmentModel.findByCode('DEFAULT');
    if (!defaultDept) {
      await departmentModel.create({
        name: 'Default Department',
        code: 'DEFAULT',
        description: 'Default department for all users',
        isActive: true
      });
      console.log('  ✅ Created default department');
    } else {
      console.log('  ⏭️  Default department already exists');
    }

    console.log('\n✅ RBAC system seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • ${roles.length} roles created`);
    console.log('   • 1 default department created');
    console.log('\n💡 Next steps:');
    console.log('   1. Run migration script to assign roles to existing users');
    console.log('   2. Create additional departments as needed');
    console.log('   3. Assign roles to users via API or admin panel');

  } catch (error) {
    console.error('❌ Error seeding RBAC:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedRBAC()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { seedRBAC };
