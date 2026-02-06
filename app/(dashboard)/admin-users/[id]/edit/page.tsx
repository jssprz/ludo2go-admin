import { notFound } from 'next/navigation';
import { prisma } from '@jssprz/ludo2go-database';
import { AdminUserForm } from '../../admin-user-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAdminUserPage({ params }: PageProps) {
  const { id } = await params;

  const [adminUser, roles] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    }),
    prisma.userRole.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!adminUser) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Admin User</h1>
        <p className="text-sm text-muted-foreground">
          Update administrator information and permissions.
        </p>
      </div>

      <AdminUserForm adminUser={adminUser} roles={roles} />
    </div>
  );
}
