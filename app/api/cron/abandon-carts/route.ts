import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { sendCartAbandonmentReport } from '@/lib/cart-abandonment-email';
import { getCartActivityCutoff, type CartActivityCounts } from '@/lib/cart-activity';
import { getCartActivityCounts } from '@/lib/repositories/cart-activity';

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

  const startedAt = new Date();
  const cutoff = getCartActivityCutoff(startedAt);
  let counts: CartActivityCounts | null = null;
  try {
    counts = await getCartActivityCounts(cutoff, prisma);
  } catch (error) {
    console.error('Scheduled cart activity count failed:', error);
  }

  let reportsSent: number;
  try {
    reportsSent = await sendCartAbandonmentReport({
      startedAt,
      completedAt: new Date(),
      cutoff,
      counts,
    });
  } catch (error) {
    console.error('Cart abandonment report failed:', error);
    return NextResponse.json({
      error: counts === null
        ? 'Cart activity counting and report delivery failed.'
        : 'Cart activity counted, but report delivery failed.',
      counts,
    }, { status: 500 });
  }
  if (counts === null) {
    return NextResponse.json({
      error: 'Scheduled cart activity count failed.',
      reportsSent,
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...counts, reportsSent });
}
