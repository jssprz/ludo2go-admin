import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildPriceRuleCarouselContent } from '@/lib/price-rule-carousel-content';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const slideId = typeof body.slideId === 'string' ? body.slideId : '';
    const ctaUrl = typeof body.ctaUrl === 'string' ? body.ctaUrl.trim() : '';
    const ctaText = typeof body.ctaText === 'string' ? body.ctaText.trim() : 'Ver oferta';
    if (!slideId || !ctaUrl) {
      return NextResponse.json({ error: 'Carousel slide and CTA destination are required.' }, { status: 400 });
    }
    if (!(/^https?:\/\//i.test(ctaUrl) || (ctaUrl.startsWith('/') && !ctaUrl.startsWith('//')))) {
      return NextResponse.json({ error: 'CTA destination must be a local path or an HTTP(S) URL.' }, { status: 400 });
    }

    const [rule, slide] = await Promise.all([
      prisma.variantPriceRule.findUnique({ where: { id } }),
      prisma.carouselSlide.findUnique({ where: { id: slideId }, select: { carouselId: true } }),
    ]);
    if (!rule) return NextResponse.json({ error: 'Price rule not found.' }, { status: 404 });
    if (!slide) return NextResponse.json({ error: 'Carousel slide not found.' }, { status: 404 });

    const payload = buildPriceRuleCarouselContent({
      id: rule.id, name: rule.name, badge: rule.badge, description: rule.description,
      active: rule.active, applied: rule.applied, startsAt: rule.startsAt, endsAt: rule.endsAt,
      currency: rule.currency, sourcePriceType: rule.sourcePriceType,
      computationType: rule.computationType, fixedAmount: rule.fixedAmount,
      percentageDiscount: rule.percentageDiscount?.toString() ?? null,
      fixedDiscountAmount: rule.fixedDiscountAmount,
    }, {
      desktopImage: typeof body.desktopImage === 'string' ? body.desktopImage : '',
      mobileImage: typeof body.mobileImage === 'string' ? body.mobileImage : '',
      ctaText, ctaUrl,
    });
    const isExternal = /^https?:\/\//i.test(ctaUrl);
    const variant = await prisma.carouselSlideVariant.create({
      data: {
        slideId,
        name: `${rule.name} price rule`,
        isActive: rule.active && rule.applied,
        payload: payload as Prisma.InputJsonValue,
        ctaText, ctaUrl,
        ctaType: isExternal ? 'EXTERNAL' : 'INTERNAL',
        ctaTarget: isExternal ? 'NEW_TAB' : 'SAME_TAB',
        startAt: rule.startsAt,
        endAt: rule.endsAt,
      },
    });
    return NextResponse.json({ id: variant.id, carouselId: slide.carouselId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create price-rule carousel variant:', error);
    return NextResponse.json({ error: 'Failed to create carousel variant.' }, { status: 500 });
  }
}