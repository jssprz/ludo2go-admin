import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildPromotionCarouselContent } from '@/lib/promotion-carousel-content';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: promotionId } = await params;
    const body = await request.json();
    const slideId = typeof body.slideId === 'string' ? body.slideId : '';
    const desktopImage = typeof body.desktopImage === 'string' ? body.desktopImage : '';
    const mobileImage = typeof body.mobileImage === 'string' ? body.mobileImage : '';
    const ctaText = typeof body.ctaText === 'string' ? body.ctaText.trim() : 'Ver promoción';
    const ctaUrl = typeof body.ctaUrl === 'string' ? body.ctaUrl.trim() : '';

    if (!slideId || !ctaUrl) {
      return NextResponse.json({ error: 'Carousel slide and CTA destination are required.' }, { status: 400 });
    }
    if (!(/^https?:\/\//i.test(ctaUrl) || (ctaUrl.startsWith('/') && !ctaUrl.startsWith('//')))) {
      return NextResponse.json({ error: 'CTA destination must be a local path or an HTTP(S) URL.' }, { status: 400 });
    }

    const [promotion, slide] = await Promise.all([
      prisma.promotion.findUnique({
        where: { id: promotionId },
        include: { promoCodeLinks: { include: { promoCode: { select: { code: true } } } } },
      }),
      prisma.carouselSlide.findUnique({
        where: { id: slideId },
        select: { id: true, carouselId: true },
      }),
    ]);

    if (!promotion) return NextResponse.json({ error: 'Promotion not found.' }, { status: 404 });
    if (!slide) return NextResponse.json({ error: 'Carousel slide not found.' }, { status: 404 });

    const promoCodes = promotion.promoCodeLinks.map((link) => link.promoCode.code);
    const payload = buildPromotionCarouselContent({
      id: promotion.id,
      name: promotion.name,
      badge: promotion.badge,
      description: promotion.description,
      status: promotion.status,
      activationMode: promotion.activationMode,
      conditions: promotion.conditions,
      benefits: promotion.benefits,
      currency: promotion.currency,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      usageLimit: promotion.usageLimit,
      usageCount: promotion.usageCount,
      perCustomerLimit: promotion.perCustomerLimit,
      promoCodes,
    }, { desktopImage, mobileImage, ctaText, ctaUrl });
    const isExternalUrl = /^https?:\/\//i.test(ctaUrl);
    const variant = await prisma.carouselSlideVariant.create({
      data: {
        slideId,
        name: `${promotion.name} promotion`,
        isActive: promotion.status === 'ACTIVE',
        payload: payload as Prisma.InputJsonValue,
        ctaText,
        ctaUrl,
        ctaType: isExternalUrl ? 'EXTERNAL' : 'INTERNAL',
        ctaTarget: isExternalUrl ? 'NEW_TAB' : 'SAME_TAB',
        startAt: promotion.startsAt,
        endAt: promotion.endsAt,
        promotions: { connect: { id: promotion.id } },
      },
    });

    return NextResponse.json({ id: variant.id, carouselId: slide.carouselId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create promotion carousel variant:', error);
    return NextResponse.json({ error: 'Failed to create carousel variant.' }, { status: 500 });
  }
}