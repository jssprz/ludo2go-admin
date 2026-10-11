import { NextResponse } from 'next/server';
import { createCustomerNoteSchema } from '@/lib/customer-notes-policy';
import {
  createCustomerNote,
  customerNotesActor,
  customerNotesErrorResponse,
  listCustomerNotes,
  CustomerNotesError,
  validateCustomerNotesWrite
} from '@/lib/customer-notes';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const actor = await customerNotesActor(id);
    return NextResponse.json(
      { notes: await listCustomerNotes(id, actor) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return customerNotesErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    validateCustomerNotesWrite(request);
    const { id } = await params;
    const actor = await customerNotesActor(id);
    const result = createCustomerNoteSchema.safeParse(await request.json());
    if (!result.success) throw new CustomerNotesError('invalid', 400);
    const noteId = await createCustomerNote(id, actor, result.data.body);
    return NextResponse.json(
      { id: noteId },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return customerNotesErrorResponse(error);
  }
}
