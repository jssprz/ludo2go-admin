import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type Params = {
  params: { id: string };
};

// GET single timeline
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const timeline = await prisma.gameTimeline.findUnique({
      where: { id: params.id },
      include: {
        events: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            linkedVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        gameDetails: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!timeline) {
      return NextResponse.json({ message: 'Timeline not found' }, { status: 404 });
    }

    return NextResponse.json(timeline);
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

// PUT update timeline
export async function PUT(request: Request, { params }: Params) {
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

    // Delete existing events and create new ones in a transaction
    const timeline = await prisma.$transaction(async (tx) => {
      // Delete all existing events
      await tx.gameTimelineEvent.deleteMany({
        where: { timelineId: params.id },
      });

      // Create new events
      const updatedTimeline = await tx.gameTimeline.update({
        where: { id: params.id },
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
          events: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          },
        },
      });

      return updatedTimeline;
    });

    return NextResponse.json(timeline);
  } catch (error: any) {
    console.error('Error updating timeline:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update timeline' },
      { status: 500 }
    );
  }
}

// DELETE timeline
export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check if timeline exists
    const timeline = await prisma.gameTimeline.findUnique({
      where: { id: params.id },
      include: {
        gameDetails: true,
      },
    });

    if (!timeline) {
      return NextResponse.json({ message: 'Timeline not found' }, { status: 404 });
    }

    // Delete the timeline (events will cascade delete)
    await prisma.gameTimeline.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Timeline deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting timeline:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to delete timeline' },
      { status: 500 }
    );
  }
}
