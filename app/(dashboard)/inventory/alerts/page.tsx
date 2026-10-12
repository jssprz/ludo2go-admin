import { redirect } from 'next/navigation';

export const metadata = { title: 'Alertas de Stock' };

export default function StockAlertsPage() {
  redirect('/inventory');
}
