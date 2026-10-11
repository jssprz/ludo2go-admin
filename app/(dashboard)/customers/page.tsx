import { getTranslations } from 'next-intl/server';
import { parseCustomerListQuery } from '@/lib/customer-list';
import {
  getCustomerListPage,
  requireCustomerAdmin
} from '@/lib/repositories/customer-list';
import { CustomersTable } from './customers-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const translate = await getTranslations('CustomerList');
  return { title: translate('title') };
}

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCustomerAdmin();
  const query = parseCustomerListQuery(await searchParams);
  let page = null;
  try {
    page = await getCustomerListPage(query);
  } catch {
    page = null;
  }
  return <CustomersTable page={page} query={query} />;
}
