import { randomUUID } from 'node:crypto';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import {
  canManageCustomerNote,
  isCustomerNotesSetupRequired
} from './customer-notes-policy';

export class CustomerNotesError extends Error {
  constructor(
    public code: string,
    public status: number
  ) {
    super(code);
  }
}

export function validateCustomerNotesWrite(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    throw new CustomerNotesError('invalid', 415);
  }
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new CustomerNotesError('forbidden', 403);
  }
}

type Actor = { id: string; role: string; name: string };
type Note = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  editorId: string;
  editorName: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export async function customerNotesActor(customerId: string): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) throw new CustomerNotesError('unauthorized', 401);
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });
  if (!admin) throw new CustomerNotesError('forbidden', 403);
  if (
    !(await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true }
    }))
  ) {
    throw new CustomerNotesError('notFound', 404);
  }
  return {
    id: admin.id,
    role: admin.role.key,
    name:
      [admin.firstName, admin.lastName].filter(Boolean).join(' ') ||
      admin.username ||
      admin.email
  };
}

export async function listCustomerNotes(customerId: string, actor: Actor) {
  const notes = await prisma.$queryRaw<Note[]>`
    SELECT "id", "body", "authorId", "authorName", "editorId", "editorName", "createdAt", "updatedAt", "version"
    FROM "CustomerNote" WHERE "customerId" = ${customerId} AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC, "id" DESC`;
  return notes.map((note) => ({
    ...note,
    canManage: canManageCustomerNote(actor.id, actor.role, note.authorId)
  }));
}

export async function createCustomerNote(
  customerId: string,
  actor: Actor,
  body: string,
  database = prisma
) {
  const id = randomUUID();
  await database.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO "CustomerNote" ("id", "customerId", "body", "authorId", "authorName", "editorId", "editorName")
      VALUES (${id}, ${customerId}, ${body}, ${actor.id}, ${actor.name}, ${actor.id}, ${actor.name})`;
    await transaction.$executeRaw`
      INSERT INTO "CustomerNoteAudit" ("id", "noteId", "actorId", "action", "version", "body")
      VALUES (${randomUUID()}, ${id}, ${actor.id}, 'create', 1, ${body})`;
  });
  return id;
}

export async function mutateCustomerNote(
  customerId: string,
  noteId: string,
  actor: Actor,
  version: number,
  body: string | null,
  database = prisma
) {
  await database.$transaction(async (transaction) => {
    const [note] = await transaction.$queryRaw<Note[]>`
      SELECT "id", "authorId", "version", "body" FROM "CustomerNote"
      WHERE "id" = ${noteId} AND "customerId" = ${customerId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!note) throw new CustomerNotesError('notFound', 404);
    if (!canManageCustomerNote(actor.id, actor.role, note.authorId))
      throw new CustomerNotesError('forbidden', 403);
    if (note.version !== version) throw new CustomerNotesError('conflict', 409);
    await transaction.$executeRaw`
      UPDATE "CustomerNote" SET "body" = ${body ?? note.body}, "editorId" = ${actor.id}, "editorName" = ${actor.name},
      "updatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1,
      "deletedAt" = CASE WHEN ${body === null} THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE "id" = ${noteId} AND "customerId" = ${customerId}`;
    await transaction.$executeRaw`
      INSERT INTO "CustomerNoteAudit" ("id", "noteId", "actorId", "action", "version", "body")
      VALUES (${randomUUID()}, ${noteId}, ${actor.id}, ${body === null ? 'delete' : 'edit'}, ${version + 1}, ${body ?? note.body})`;
  });
}

export function customerNotesErrorResponse(error: unknown) {
  const headers = { 'Cache-Control': 'no-store' };
  if (error instanceof CustomerNotesError)
    return NextResponse.json(
      { code: error.code },
      { status: error.status, headers }
    );
  if (isCustomerNotesSetupRequired(error))
    return NextResponse.json(
      { code: 'setupRequired' },
      { status: 503, headers }
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ code: 'invalid' }, { status: 400, headers });
  return NextResponse.json({ code: 'failed' }, { status: 500, headers });
}
