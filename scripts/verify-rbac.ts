// Verify RBAC System Status
import { getDB } from '../src/lib/db/mongodb.js';
import { UserModel } from '../src/lib/models/user.js';
import { RoleModel } from '../src/lib/models/role.js';
import { DepartmentModel } from '../src/lib/models/department.js';
import { AgentModel } from '../src/lib/models/agent.js';
import { getUserRoles, getUserPermissions } from '../src/lib/rbac-middleware.js';

async function verifyRBAC() {
  try {
    console.log('🔍 Verifying RBAC System...\n');
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);
    const agentModel = new AgentModel(db);

    // Check Roles
    console.log('📋 Roles:');
    const roles = await roleModel.listAll();
    console.log(`   Found ${roles.length} roles:`);
    roles.forEach(role => {
      console.log(`   • ${role.name} (${role.displayName}) - ${role.permissions.length} permissions`);
    });

    // Check Departments
    console.log('\n🏢 Departments:');
    const departments = await departmentModel.listAll();
    console.log(`   Found ${departments.length} departments:`);
    departments.forEach(dept => {
      console.log(`   • ${dept.code} - ${dept.name} (${dept.isActive ? 'Active' : 'Inactive'})`);
    });

    // Check Users
    console.log('\n👥 Users:');
    const users = await userModel.listAll();
    console.log(`   Found ${users.length} users:`);
    
    for (const user of users) {
      const roles = await getUserRoles(user._id!);
      const permissions = await getUserPermissions(user._id!);
      const isAgent = !!user.agentProfile?.isActive;
      
      console.log(`   • ${user.email}`);
      console.log(`     - Type: ${user.userType}`);
      console.log(`     - Roles: ${roles.length > 0 ? roles.join(', ') : 'None'}`);
      console.log(`     - Permissions: ${permissions.length} total`);
      console.log(`     - Departments: ${user.departments?.length || 0}`);
      console.log(`     - Agent: ${isAgent ? 'Yes' : 'No'}`);
    }

    // Check Agents
    console.log('\n🤝 Agents:');
    const agents = await agentModel.listAll();
    console.log(`   Found ${agents.length} agents:`);
    agents.forEach(agent => {
      console.log(`   • ${agent.agencyName} (${agent.isActive ? 'Active' : 'Inactive'})`);
      console.log(`     - Commission: ${agent.commissionRate}%`);
      console.log(`     - Billing: ${agent.billingMethod}`);
    });

    console.log('\n✅ RBAC System Verification Complete!');
    console.log('\n📊 Summary:');
    console.log(`   • ${roles.length} roles defined`);
    console.log(`   • ${departments.length} departments created`);
    console.log(`   • ${users.length} users in system`);
    console.log(`   • ${agents.length} agents registered`);

  } catch (error) {
    console.error('❌ Error verifying RBAC:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyRBAC()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { verifyRBAC };
