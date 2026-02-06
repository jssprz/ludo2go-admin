import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const user = await prisma.adminUser.findUnique({
      where: { id },
      include: {
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Admin user not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error fetching admin user:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { email, username, firstName, lastName, phone, avatar, roleId, password } = body;

    // Validate required fields
    if (!email || !roleId) {
      return NextResponse.json(
        { message: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Validate password if provided
    if (password && password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { message: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Check if email is taken by another user
    if (email !== existingUser.email) {
      const emailTaken = await prisma.adminUser.findUnique({
        where: { email },
      });

      if (emailTaken) {
        return NextResponse.json(
          { message: 'An admin user with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Check if username is taken by another user (if provided)
    if (username && username !== existingUser.username) {
      const usernameTaken = await prisma.adminUser.findUnique({
        where: { username },
      });

      if (usernameTaken) {
        return NextResponse.json(
          { message: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    // Verify role exists
    const role = await prisma.userRole.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { message: 'Invalid role' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      email,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      avatar: avatar || null,
      roleId,
    };

    // Hash and update password if provided
    if (password) {
      // @ts-ignore - passwordHash field will be added via schema migration
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // Update the admin user
    const updatedUser = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
      },
    });

    return NextResponse.json({
      message: 'Admin user updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating admin user:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Check if user exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { message: 'Admin user not found' },
        { status: 404 }
      );
    }

    // TODO: Add check to prevent deleting yourself
    // TODO: Add check to prevent deleting the last admin

    // Delete the admin user
    await prisma.adminUser.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Admin user deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting admin user:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
