import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { AdminUsersTable } from './admin-users-table';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage administrator accounts and permissions.
          </p>
        </div>
        <Link href="/admin-users/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Admin User
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <AdminUsersTable />
      </Suspense>
    </div>
  );
}
