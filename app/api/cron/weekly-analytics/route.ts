import { NextResponse } from 'next/server';
import { sendWeeklyAnalyticsReport } from '@/lib/weekly-analytics-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron authentication is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await sendWeeklyAnalyticsReport();
    return NextResponse.json({ ok: true, sent: result.sent, period: result.period });
  } catch (error) {
    console.error('Weekly analytics report failed:', error);
    return NextResponse.json({ error: 'Weekly analytics report failed.' }, { status: 500 });
  }
}