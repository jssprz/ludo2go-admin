'use client';

import { useState, FormEvent } from 'react';
import type { AdminUser, UserRole } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

type AdminUserWithRole = AdminUser & {
  role: UserRole;
};

type Props = {
  adminUser?: AdminUserWithRole;
  roles: UserRole[];
};

export function AdminUserForm({ adminUser, roles }: Props) {
  const router = useRouter();
  const isEditing = !!adminUser;

  const [email, setEmail] = useState(adminUser?.email || '');
  const [username, setUsername] = useState(adminUser?.username || '');
  const [firstName, setFirstName] = useState(adminUser?.firstName || '');
  const [lastName, setLastName] = useState(adminUser?.lastName || '');
  const [phone, setPhone] = useState(adminUser?.phone || '');
  const [avatar, setAvatar] = useState(adminUser?.avatar || '');
  const [roleId, setRoleId] = useState(adminUser?.roleId || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !roleId) {
      setErrorMsg('Email and role are required');
      setIsSaving(false);
      return;
    }

    // Validate password for new users
    if (!isEditing && !password) {
      setErrorMsg('Password is required for new users');
      setIsSaving(false);
      return;
    }

    // Validate password match
    if (password && password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      setIsSaving(false);
      return;
    }

    // Validate password strength
    if (password && password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      setIsSaving(false);
      return;
    }

    try {
      const url = isEditing
        ? `/api/users/${adminUser.id}`
        : '/api/users';

      const method = isEditing ? 'PUT' : 'POST';

      const body: any = {
        email,
        username: username || null,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        avatar: avatar || null,
        roleId,
      };

      // Only include password if provided
      if (password) {
        body.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Failed to ${isEditing ? 'update' : 'create'} admin user`);
      }

      const data = await res.json();
      setSuccessMsg(`Admin user ${isEditing ? 'updated' : 'created'} successfully.`);
      
      // Redirect after a short delay
      setTimeout(() => {
        if (!isEditing && data.user?.id) {
          router.push(`/admin-users/${data.user.id}/edit`);
        } else {
          router.push('/admin-users');
        }
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;

    const confirmed = confirm(
      `Are you sure you want to delete the admin user "${email}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/users/${adminUser.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete admin user');
      }

      setSuccessMsg('Admin user deleted successfully.');
      setTimeout(() => {
        router.push('/admin-users');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>
            Basic information about the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              Role <span className="text-red-500">*</span>
            </Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    {role.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        — {role.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            {isEditing 
              ? 'Set a new password (leave blank to keep current password)'
              : 'Set a password for this user to login'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {!isEditing && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password {!isEditing && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                minLength={8}
                autoComplete="new-password"
              />
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="p-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md">
          {successMsg}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={isSaving || isDeleting}>
            {isSaving ? 'Saving...' : isEditing ? 'Update User' : 'Create User'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving || isDeleting}
          >
            Cancel
          </Button>
        </div>

        {isEditing && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete User'}
          </Button>
        )}
      </div>
    </form>
  );
}
