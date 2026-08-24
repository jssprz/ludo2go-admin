'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import clsx from 'clsx';
import {
  Home,
  LineChart,
  Search,
  Package,
  Layers,
  Settings,
  ShoppingCart,
  Users2,
  UserCog,
  Clock,
  Boxes,
  MapPin,
  Warehouse,
  Image as ImageIcon,
  Mail,
  Images,
  Tag,
  Gamepad2,
  Puzzle,
  Palette,
  Wrench,
  BookOpen,
  Store,
  Truck,
  ClipboardList,
  CalendarPlus,
  TrendingUp,
  Sigma,
  BarChart3,
  DollarSign,
  FolderOpen,
  ChevronDown,
  Pin,
  PinOff,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from './sidebar-context';
import Image from 'next/image';

const LOGO_URL = `${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/assets/jobys-logo-130x59.png`;

type NavItemDef = {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItemDef[];
};

function useNavGroups(t: ReturnType<typeof useTranslations<'nav'>>): NavGroup[] {
  return [
    {
      id: 'ventas',
      label: 'Ventas',
      icon: <ShoppingCart className="h-4 w-4" />,
      items: [
        { href: '/orders', labelKey: 'orders', icon: <ShoppingCart className="h-4 w-4" /> },
        { href: '/promo-codes', labelKey: 'promoCodes', icon: <Tag className="h-4 w-4" /> },
        { href: '/presale', labelKey: 'presale', icon: <CalendarPlus className="h-4 w-4" /> },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      icon: <Package className="h-4 w-4" />,
      items: [
        { href: '/products', labelKey: 'products', icon: <Package className="h-4 w-4" /> },
        { href: '/bundles', labelKey: 'bundles', icon: <Layers className="h-4 w-4" /> },
        { href: '/brands', labelKey: 'brands', icon: <Tag className="h-4 w-4" /> },
        { href: '/recommendation-profiles', labelKey: 'recommendationProfiles', icon: <Sigma className="h-4 w-4" /> },
        { href: '/game-categories', labelKey: 'gameCategories', icon: <Gamepad2 className="h-4 w-4" /> },
        { href: '/accessory-categories', labelKey: 'accessoryCategories', icon: <Puzzle className="h-4 w-4" /> },
        { href: '/game-themes', labelKey: 'gameThemes', icon: <Palette className="h-4 w-4" /> },
        { href: '/game-mechanics', labelKey: 'gameMechanics', icon: <Wrench className="h-4 w-4" /> },
        { href: '/game-complexities', labelKey: 'gameComplexities', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <Boxes className="h-4 w-4" />,
      items: [
        { href: '/inventory', labelKey: 'inventory', icon: <Boxes className="h-4 w-4" /> },
        { href: '/prices', labelKey: 'prices', icon: <DollarSign className="h-4 w-4" /> },
        { href: '/locations', labelKey: 'locations', icon: <Warehouse className="h-4 w-4" /> },
      ],
    },
    {
      id: 'compras',
      label: 'Compras',
      icon: <Truck className="h-4 w-4" />,
      items: [
        { href: '/suppliers', labelKey: 'suppliers', icon: <Truck className="h-4 w-4" /> },
        { href: '/purchase-orders', labelKey: 'purchaseOrders', icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users2 className="h-4 w-4" />,
      items: [
        { href: '/customers', labelKey: 'customers', icon: <Users2 className="h-4 w-4" /> },
        { href: '/early-access', labelKey: 'earlyAccess', icon: <Mail className="h-4 w-4" /> },
      ],
    },
    {
      id: 'contenido',
      label: 'Contenido',
      icon: <BookOpen className="h-4 w-4" />,
      items: [
        { href: '/guides', labelKey: 'guides', icon: <BookOpen className="h-4 w-4" /> },
        { href: '/guide-categories', labelKey: 'guideCategories', icon: <FolderOpen className="h-4 w-4" /> },
        { href: '/carousels', labelKey: 'carousels', icon: <Images className="h-4 w-4" /> },
        { href: '/media', labelKey: 'mediaGallery', icon: <ImageIcon className="h-4 w-4" /> },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: <TrendingUp className="h-4 w-4" />,
      items: [
        { href: '/external-trending', labelKey: 'trending', icon: <TrendingUp className="h-4 w-4" /> },
      ],
    },
    {
      id: 'analitica',
      label: 'Analítica',
      icon: <LineChart className="h-4 w-4" />,
      items: [
        { href: '/search-analytics', labelKey: 'searchAnalytics', icon: <Search className="h-4 w-4" /> },
        { href: '/analytics', labelKey: 'analytics', icon: <LineChart className="h-4 w-4" /> },
      ],
    },
    {
      id: 'administracion',
      label: 'Administración',
      icon: <Settings className="h-4 w-4" />,
      items: [
        { href: '/stores', labelKey: 'stores', icon: <Store className="h-4 w-4" /> },
        { href: '/pickup-locations', labelKey: 'pickupLocations', icon: <MapPin className="h-4 w-4" /> },
        { href: '/timelines', labelKey: 'timelines', icon: <Clock className="h-4 w-4" /> },
        { href: '/admin-users', labelKey: 'adminUsers', icon: <UserCog className="h-4 w-4" /> },
        { href: '#', labelKey: 'settings', icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ];
}

function SidebarNavItem({
  href,
  label,
  icon,
  isExpanded,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isExpanded: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

  const linkContent = (
    <Link
      href={href}
      className={clsx(
        'flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
        isExpanded ? 'w-full' : 'w-8 justify-center',
        isActive && 'bg-accent text-foreground font-medium',
      )}
    >
      <span className="shrink-0">{icon}</span>
      {isExpanded && <span className="truncate">{label}</span>}
    </Link>
  );

  if (isExpanded) return linkContent;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarGroup({
  group,
  isExpanded,
  t,
}: {
  group: NavGroup;
  isExpanded: boolean;
  t: ReturnType<typeof useTranslations<'nav'>>;
}) {
  const pathname = usePathname();
  const hasActiveChild = group.items.some(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
  );

  const [isOpen, setIsOpen] = useState(() => hasActiveChild);

  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              aria-label={group.label}
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-muted-foreground',
                hasActiveChild && 'bg-accent text-foreground',
              )}
            >
              {group.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{group.label}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={clsx(
          'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground',
          hasActiveChild && 'text-foreground',
        )}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Contraer' : 'Expandir'} ${group.label}`}
      >
        <span className="shrink-0">{group.icon}</span>
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={clsx('h-3 w-3 transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen &&
        group.items.map((item) => (
          <div key={item.href} className="pl-3">
            <SidebarNavItem
              href={item.href}
              label={t(item.labelKey as Parameters<typeof t>[0])}
              icon={item.icon}
              isExpanded={true}
            />
          </div>
        ))}
    </div>
  );
}

export function Sidebar() {
  const { isPinned, togglePin } = useSidebar();
  const t = useTranslations('nav');
  const groups = useNavGroups(t);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isPinned || isHovered;

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-10 hidden flex-col border-r bg-background transition-all duration-200 sm:flex',
        isExpanded ? 'w-64' : 'w-14',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b px-2">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-primary"
        >
          <Image
            src={LOGO_URL}
            alt="Joby's"
            width={130}
            height={59}
            className="h-5 w-auto transition-all"
          />
          <span className="sr-only">Joby&apos;s</span>
        </Link>
        <button
          onClick={togglePin}
          aria-label={isPinned ? 'Desanclar barra lateral' : 'Anclar barra lateral'}
          className={clsx(
            'h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground',
            isExpanded ? 'flex' : 'hidden',
          )}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Dashboard link */}
      <div className="px-2 pt-3 pb-1">
        <SidebarNavItem
          href="/"
          label={t('dashboard')}
          icon={<Home className="h-4 w-4" />}
          isExpanded={isExpanded}
        />
      </div>

      {/* Nav groups */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            isExpanded={isExpanded}
            t={t}
          />
        ))}
      </nav>
    </aside>
  );
}

export function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const { isPinned } = useSidebar();
  return (
    <div
      className={clsx(
        'flex flex-col sm:gap-4 sm:py-4 transition-all duration-200',
        isPinned ? 'sm:pl-64' : 'sm:pl-14',
      )}
    >
      {children}
    </div>
  );
}
