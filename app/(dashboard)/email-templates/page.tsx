import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EmailTemplatesManager } from './email-templates-manager';

export const metadata = { title: 'Email templates' };

export default async function EmailTemplatesPage() {
  if (!(await auth())?.user?.id) redirect('/login');
  const t = await getTranslations('emailTemplates');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
      </div>
      <EmailTemplatesManager />
    </div>
  );
}
