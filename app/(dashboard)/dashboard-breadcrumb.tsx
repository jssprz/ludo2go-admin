'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const NAV_LABEL_KEYS: Record<string, string> = {
  orders: 'orders',
  products: 'products',
  bundles: 'bundles',
  brands: 'brands',
  recommendationProfiles: 'recommendationProfiles',
  'recommendation-profiles': 'recommendationProfiles',
  'game-categories': 'gameCategories',
  'accessory-categories': 'accessoryCategories',
  'game-themes': 'gameThemes',
  'game-mechanics': 'gameMechanics',
  'game-complexities': 'gameComplexities',
  'board-game-awards': 'boardGameAwards',
  inventory: 'inventory',
  prices: 'prices',
  locations: 'locations',
  suppliers: 'suppliers',
  'purchase-orders': 'purchaseOrders',
  opportunities: 'opportunities',
  customers: 'customers',
  'early-access': 'earlyAccess',
  guides: 'guides',
  'guide-categories': 'guideCategories',
  carousels: 'carousels',
  media: 'mediaGallery',
  'external-trending': 'trending',
  analytics: 'analytics',
  'search-analytics': 'searchAnalytics',
  'match-tool-analytics': 'matchToolAnalytics',
  stores: 'stores',
  'pickup-locations': 'pickupLocations',
  couriers: 'couriers',
  timelines: 'timelines',
  'admin-users': 'adminUsers',
  variants: 'variants',
};

const STATIC_LABELS: Record<string, string> = {
  edit: 'Edit',
  new: 'New',
  receive: 'Receive',
  details: 'Details',
  costs: 'Costs',
  alerts: 'Alerts',
  discrepancies: 'Discrepancies',
  manual: 'Manual',
};

function isRecordIdSegment(segment: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      segment,
    ) || /^\d+$/.test(segment)
  );
}

function formatSegment(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');

  const rawSegments = pathname.split('/').filter(Boolean);
  const visibleSegmentIndexes = rawSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => !isRecordIdSegment(segment))
    .map(({ index }) => index);

  const lastVisibleIndex =
    visibleSegmentIndexes.length > 0
      ? visibleSegmentIndexes[visibleSegmentIndexes.length - 1]
      : -1;

  const items = rawSegments
    .map((segment, index) => {
      if (isRecordIdSegment(segment)) return null;

      const navKey = NAV_LABEL_KEYS[segment];
      const label = navKey
        ? tNav(navKey)
        : STATIC_LABELS[segment] ?? formatSegment(segment);

      return {
        href: `/${rawSegments.slice(0, index + 1).join('/')}`,
        label,
        isCurrent: index === lastVisibleIndex,
      };
    })
    .filter((item): item is { href: string; label: string; isCurrent: boolean } => Boolean(item));

  return (
    <Breadcrumb className="hidden shrink-0 md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          {items.length === 0 ? (
            <BreadcrumbPage>{tNav('dashboard')}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/">{tNav('dashboard')}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {items.map((item) => (
          <BreadcrumbItem key={item.href}>
            <BreadcrumbSeparator />
            {item.isCurrent ? (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.href}>{item.label}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
