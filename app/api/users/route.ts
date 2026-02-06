import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, username, firstName, lastName, phone, avatar, roleId, password } = body;

    // Validate required fields
    if (!email || !roleId) {
      return NextResponse.json(
        { message: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Validate password
    if (!password) {
      return NextResponse.json(
        { message: 'Password is required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'An admin user with this email already exists' },
        { status: 409 }
      );
    }

    // Check if username exists (if provided)
    if (username) {
      const existingUsername = await prisma.adminUser.findUnique({
        where: { username },
      });

      if (existingUsername) {
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

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the admin user
    const newUser = await prisma.adminUser.create({
      data: {
        email,
        username: username || null,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        avatar: avatar || null,
        password: passwordHash,
        roleId,
      },
      include: {
        role: true,
      },
    });

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: newUser,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const users = await prisma.adminUser.findMany({
      include: {
        role: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
