// Migrate Existing Users to RBAC System
import { getDB } from '../src/lib/db/mongodb.js';
import { UserModel, type UserType } from '../src/lib/models/user.js';
import { RoleModel } from '../src/lib/models/role.js';
import { DepartmentModel } from '../src/lib/models/department.js';
import { ObjectId } from 'mongodb';

async function migrateUsersToRBAC(force = false) {
  try {
    console.log('🔄 Migrating users to RBAC system...\n');
    if (force) {
      console.log('⚠️  Force mode enabled - will re-migrate users with existing roles\n');
    }
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);

    // Get or create default department
    let defaultDept = await departmentModel.findByCode('DEFAULT');
    if (!defaultDept) {
      defaultDept = await departmentModel.create({
        name: 'Default Department',
        code: 'DEFAULT',
        description: 'Default department for all users',
        isActive: true
      });
      console.log('✅ Created default department');
    }

    // Get all users
    const users = await userModel.listAll();
    console.log(`📋 Found ${users.length} users to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      // Skip if user already has active roles assigned (unless force mode)
      if (!force) {
        // Check if roles exist and have at least one active role
        if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
          const hasActiveRoles = user.roles.some((ra: any) => ra.isActive !== false);
          if (hasActiveRoles) {
            console.log(`⏭️  User ${user.email} already has active roles, skipping...`);
            skipped++;
            continue;
          }
        }
      }
      
      // Initialize roles and departments arrays if they don't exist
      if (!user.roles || !Array.isArray(user.roles)) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { roles: [] } }
        );
        user.roles = [];
      }
      if (!user.departments || !Array.isArray(user.departments)) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { departments: [] } }
        );
        user.departments = [];
      }

      // Map userType to role
      let roleName: string;
      switch (user.userType) {
        case 'admin':
          roleName = 'super_admin';
          break;
        case 'premium':
        case 'freetier':
        default:
          roleName = 'job_seeker';
          break;
      }

      // Verify role exists
      const role = await roleModel.findByName(roleName);
      if (!role) {
        console.error(`❌ Role '${roleName}' not found for user ${user.email}, skipping...`);
        console.error(`   💡 Tip: Run 'npm run seed-rbac' first to create roles`);
        skipped++;
        continue;
      }

      // Assign role
      const roleAssignment = {
        role: roleName,
        departmentId: defaultDept._id!,
        grantedBy: user._id!, // Self-granted for migration
        grantedAt: new Date(),
        isActive: true
      };

      try {
        await userModel.assignRole(user._id!, roleAssignment);
        await userModel.addDepartment(user._id!, defaultDept._id!);
        await userModel.setPrimaryDepartment(user._id!, defaultDept._id!);
        
        console.log(`✅ Migrated ${user.email}: ${user.userType} → ${roleName}`);
        migrated++;
      } catch (error: any) {
        console.error(`❌ Failed to migrate ${user.email}:`, error.message);
        skipped++;
      }

      console.log(`✅ Migrated ${user.email}: ${user.userType} → ${roleName}`);
      migrated++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   • Migrated: ${migrated} users`);
    console.log(`   • Skipped: ${skipped} users`);
    console.log('\n✅ Migration completed!');

  } catch (error) {
    console.error('❌ Error migrating users:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  migrateUsersToRBAC(force)
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { migrateUsersToRBAC };
