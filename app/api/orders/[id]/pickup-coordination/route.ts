import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { sendPickupCoordinationEmail } from '@/lib/pickup-coordination-email';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const preview = new URL(request.url).searchParams.get('preview') === 'true';
    if (preview && !session.user.email?.trim()) {
      return NextResponse.json({ message: 'Tu cuenta no tiene un correo registrado para recibir la vista previa.' }, { status: 400 });
    }
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        fulfillmentMethod: true,
        status: true,
        customer: { select: { email: true, firstName: true, lastName: true } },
        pickupLocation: true,
      },
    });
    if (!order) return NextResponse.json({ message: 'Pedido no encontrado.' }, { status: 404 });
    if (order.fulfillmentMethod !== 'pickup' || ['cancelled', 'delivered'].includes(order.status)) {
      return NextResponse.json({ message: 'Solo se puede coordinar el retiro de pedidos activos con retiro en tienda.' }, { status: 400 });
    }
    const recipient = preview ? session.user.email?.trim() : order.customer?.email?.trim();
    if (!recipient) {
      return NextResponse.json({ message: 'El cliente no tiene un correo electrónico registrado.' }, { status: 400 });
    }
    await sendPickupCoordinationEmail({
      orderId: order.id,
      email: recipient,
      customerName: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' '),
      pickupLocation: order.pickupLocation,
    });
    return NextResponse.json({ message: preview ? 'Vista previa enviada a tu correo. No se envió al cliente.' : 'Correo de coordinación enviado.' });
  } catch {
    // Do not log provider payloads containing customer contact details.
    console.error('Pickup coordination email failed.');
    return NextResponse.json({ message: 'No se pudo enviar el correo de coordinación. Intenta nuevamente.' }, { status: 500 });
  }
}
