import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { AdminUserForm } from '../admin-user-form';

export default async function NewAdminUserPage() {
  // Fetch all roles for the dropdown
  const roles = await prisma.userRole.findMany({
    orderBy: { name: 'asc' },
  });

  if (roles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Admin User</h1>
          <p className="text-sm text-muted-foreground">
            No roles found. Please create roles first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Admin User</h1>
        <p className="text-sm text-muted-foreground">
          Add a new administrator to the system.
        </p>
      </div>

      <AdminUserForm roles={roles} />
    </div>
  );
}
