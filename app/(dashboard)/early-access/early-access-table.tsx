'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Mail, Check, Download } from 'lucide-react';

type EarlyAccessEmail = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: string | null;
  referrer: string | null;
  interestedIn: string[];
  discountCode: string | null;
  notified: boolean;
  convertedToUser: boolean;
  createdAt: Date;
};

type Props = {
  emails: EarlyAccessEmail[];
};

export function EarlyAccessTable({ emails }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNotified, setFilterNotified] = useState<string>('all');
  const [filterConverted, setFilterConverted] = useState<string>('all');

  // Get unique sources for filtering
  const sources = Array.from(new Set(emails.map((e) => e.source).filter(Boolean))) as string[];

  // Filter emails
  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.source?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesNotified =
      filterNotified === 'all' ||
      (filterNotified === 'yes' && email.notified) ||
      (filterNotified === 'no' && !email.notified);

    const matchesConverted =
      filterConverted === 'all' ||
      (filterConverted === 'yes' && email.convertedToUser) ||
      (filterConverted === 'no' && !email.convertedToUser);

    return matchesSearch && matchesNotified && matchesConverted;
  });

  async function handleMarkNotified(id: string) {
    try {
      const res = await fetch(`/api/early-access/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notified: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to update');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this email from the list?')) return;

    try {
      const res = await fetch(`/api/early-access/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    }
  }

  function exportToCsv() {
    const headers = ['Email', 'First Name', 'Last Name', 'Source', 'Referrer', 'Interested In', 'Discount Code', 'Notified', 'Converted', 'Created At'];
    const rows = filteredEmails.map((e) => [
      e.email,
      e.firstName || '',
      e.lastName || '',
      e.source || '',
      e.referrer || '',
      e.interestedIn.join('; '),
      e.discountCode || '',
      e.notified ? 'Yes' : 'No',
      e.convertedToUser ? 'Yes' : 'No',
      new Date(e.createdAt).toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `early-access-emails-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (emails.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No early access emails collected yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by email, name, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Select value={filterNotified} onValueChange={setFilterNotified}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Notified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Notified</SelectItem>
              <SelectItem value="no">Not Notified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterConverted} onValueChange={setFilterConverted}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Converted" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Converted</SelectItem>
              <SelectItem value="no">Not Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportToCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV ({filteredEmails.length})
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Interested In</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Discount Code</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmails.map((email) => (
              <TableRow key={email.id}>
                <TableCell className="font-medium">{email.email}</TableCell>
                <TableCell>
                  {email.firstName || email.lastName
                    ? `${email.firstName || ''} ${email.lastName || ''}`.trim()
                    : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  {email.source ? (
                    <Badge variant="outline">{email.source}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {email.interestedIn.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {email.interestedIn.slice(0, 2).map((interest) => (
                        <Badge key={interest} variant="secondary" className="text-xs">
                          {interest}
                        </Badge>
                      ))}
                      {email.interestedIn.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{email.interestedIn.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge
                      variant={email.notified ? 'default' : 'secondary'}
                      className={
                        email.notified
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : ''
                      }
                    >
                      {email.notified ? 'Notified' : 'Pending'}
                    </Badge>
                    {email.convertedToUser && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Converted
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {email.discountCode ? (
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {email.discountCode}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(email.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigator.clipboard.writeText(email.email)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Copy Email
                      </DropdownMenuItem>
                      {!email.notified && (
                        <DropdownMenuItem
                          onClick={() => handleMarkNotified(email.id)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Mark as Notified
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(email.id)}
                        className="text-red-600"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredEmails.length === 0 && searchQuery && (
        <p className="text-center text-muted-foreground py-4">
          No emails found matching your filters
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Showing {filteredEmails.length} of {emails.length} emails
      </p>
    </div>
  );
}
