import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@jssprz/ludo2go-database';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/early-access/[id] - Update an early access email
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { notified, convertedToUser } = body;

    const updateData: Record<string, boolean> = {};
    
    if (typeof notified === 'boolean') {
      updateData.notified = notified;
    }
    
    if (typeof convertedToUser === 'boolean') {
      updateData.convertedToUser = convertedToUser;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const email = await prisma.earlyAccessEmail.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(email);
  } catch (error: any) {
    console.error('Failed to update early access email:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Early access email not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update early access email' },
      { status: 500 }
    );
  }
}

// DELETE /api/early-access/[id] - Delete an early access email
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.earlyAccessEmail.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete early access email:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Early access email not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete early access email' },
      { status: 500 }
    );
  }
}
