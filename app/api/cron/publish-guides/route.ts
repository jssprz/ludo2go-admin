import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { GuideStatus } from '@prisma/client';

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
    const now = new Date();
    const result = await prisma.guide.updateMany({
      where: {
        status: GuideStatus.scheduled,
        scheduledAt: { lte: now },
      },
      data: {
        status: GuideStatus.published,
        publishedAt: now,
        scheduledAt: null,
      },
    });
    return NextResponse.json({ ok: true, published: result.count });
  } catch (error) {
    console.error('Scheduled guide publishing failed:', error);
    return NextResponse.json({ error: 'Scheduled guide publishing failed.' }, { status: 500 });
  }
}