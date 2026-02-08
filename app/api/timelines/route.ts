import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET all timelines
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const timelines = await prisma.gameTimeline.findMany({
      include: {
        events: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
        gameDetails: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(timelines);
  } catch (error: any) {
    console.error('Error fetching timelines:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch timelines' },
      { status: 500 }
    );
  }
}

// POST create new timeline
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { message: 'Timeline must have at least one event' },
        { status: 400 }
      );
    }

    // Create timeline with events in a transaction
    const timeline = await prisma.gameTimeline.create({
      data: {
        events: {
          create: events.map((event: any) => ({
            eventType: event.eventType || null,
            month: event.month || null,
            year: event.year,
            title: event.title,
            description: event.description,
            image: event.image || null,
            refLink: event.refLink || null,
            linkedVariantId: event.linkedVariantId || null,
          })),
        },
      },
      include: {
        events: true,
      },
    });

    return NextResponse.json(timeline, { status: 201 });
  } catch (error: any) {
    console.error('Error creating timeline:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to create timeline' },
      { status: 500 }
    );
  }
}
