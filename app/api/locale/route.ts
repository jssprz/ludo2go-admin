import { NextRequest, NextResponse } from 'next/server';
import { locales, Locale } from '@/lib/i18n';

export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();
    
    if (!locales.includes(locale as Locale)) {
      return NextResponse.json(
        { error: 'Invalid locale' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ success: true, locale });
    
    // Set the locale cookie (expires in 1 year)
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to change locale' },
      { status: 500 }
    );
  }
}
