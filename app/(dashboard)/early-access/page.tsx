import { prisma } from '@jssprz/ludo2go-database';
import { EarlyAccessTable } from './early-access-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function EarlyAccessPage() {
  const emails = await prisma.earlyAccessEmail.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Calculate stats
  const totalEmails = emails.length;
  const notifiedCount = emails.filter((e) => e.notified).length;
  const convertedCount = emails.filter((e) => e.convertedToUser).length;
  const conversionRate = totalEmails > 0 ? ((convertedCount / totalEmails) * 100).toFixed(1) : 0;

  // Source breakdown
  const sourceBreakdown = emails.reduce((acc, e) => {
    const source = e.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Early Access Emails</h1>
        <p className="text-muted-foreground">
          Manage early access signups collected before launch
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Signups</CardDescription>
            <CardTitle className="text-3xl">{totalEmails}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Notified</CardDescription>
            <CardTitle className="text-3xl">{notifiedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalEmails > 0 ? ((notifiedCount / totalEmails) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Converted to Users</CardDescription>
            <CardTitle className="text-3xl">{convertedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {conversionRate}% conversion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Source</CardDescription>
            <CardTitle className="text-xl">
              {Object.entries(sourceBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {(Object.entries(sourceBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[1] as number) || 0} signups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Table */}
      <EarlyAccessTable emails={emails} />
    </div>
  );
}
