import { NextResponse } from 'next/server';
import {
  deleteCustomerNoteSchema,
  updateCustomerNoteSchema
} from '@/lib/customer-notes-policy';
import {
  customerNotesActor,
  customerNotesErrorResponse,
  mutateCustomerNote,
  CustomerNotesError,
  validateCustomerNotesWrite
} from '@/lib/customer-notes';

type Context = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    validateCustomerNotesWrite(request);
    const { id, noteId } = await params;
    const actor = await customerNotesActor(id);
    const result = updateCustomerNoteSchema.safeParse(await request.json());
    if (!result.success) throw new CustomerNotesError('invalid', 400);
    await mutateCustomerNote(
      id,
      noteId,
      actor,
      result.data.version,
      result.data.body
    );
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return customerNotesErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    validateCustomerNotesWrite(request);
    const { id, noteId } = await params;
    const actor = await customerNotesActor(id);
    const result = deleteCustomerNoteSchema.safeParse(await request.json());
    if (!result.success) throw new CustomerNotesError('invalid', 400);
    await mutateCustomerNote(id, noteId, actor, result.data.version, null);
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return customerNotesErrorResponse(error);
  }
}
