import Link from 'next/link';
import {
  Home,
  LineChart,
  Search,
  Package,
  Layers,
  PanelLeft,
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
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Image from 'next/image';
import { Analytics } from '@vercel/analytics/react';
import { User } from './user';
import Providers from './providers';
import { SearchInput } from './search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { TimeZoneSwitcher } from '@/components/timezone-switcher';
import { getTranslations } from 'next-intl/server';
import { Sidebar, MainContentWrapper } from './sidebar';

const LOGO_URL = `${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/assets/jobys-logo-130x59.png`;

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <main className="flex min-h-screen w-full flex-col bg-muted/40">
        <Sidebar />
        <MainContentWrapper>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileNav />
            <DashboardBreadcrumb />
            <SearchInput />
            <TimeZoneSwitcher />
            <LanguageSwitcher />
            <User />
          </header>
          <main className="grid flex-1 items-start gap-2 p-4 sm:px-6 sm:py-0 md:gap-4 bg-muted/40">
            {children}
          </main>
        </MainContentWrapper>
        <Analytics />
      </main>
    </Providers>
  );
}

async function MobileNav() {
  const t = await getTranslations('nav');
  const lc = 'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground';
  const groups = [
    {
      label: 'Ventas',
      items: [
        { href: '/orders', label: t('orders'), icon: <ShoppingCart className="h-4 w-4" /> },
        { href: '/promo-codes', label: t('promoCodes'), icon: <Tag className="h-4 w-4" /> },
        { href: '/presale', label: t('presale'), icon: <CalendarPlus className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Catálogo',
      items: [
        { href: '/products', label: t('products'), icon: <Package className="h-4 w-4" /> },
        { href: '/bundles', label: t('bundles'), icon: <Layers className="h-4 w-4" /> },
        { href: '/brands', label: t('brands'), icon: <Tag className="h-4 w-4" /> },
        { href: '/recommendation-profiles', label: t('recommendationProfiles'), icon: <Sigma className="h-4 w-4" /> },
        { href: '/game-categories', label: t('gameCategories'), icon: <Gamepad2 className="h-4 w-4" /> },
        { href: '/accessory-categories', label: t('accessoryCategories'), icon: <Puzzle className="h-4 w-4" /> },
        { href: '/game-themes', label: t('gameThemes'), icon: <Palette className="h-4 w-4" /> },
        { href: '/game-mechanics', label: t('gameMechanics'), icon: <Wrench className="h-4 w-4" /> },
        { href: '/game-complexities', label: t('gameComplexities'), icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Inventario',
      items: [
        { href: '/inventory', label: t('inventory'), icon: <Boxes className="h-4 w-4" /> },
        { href: '/prices', label: t('prices'), icon: <DollarSign className="h-4 w-4" /> },
        { href: '/locations', label: t('locations'), icon: <Warehouse className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Compras',
      items: [
        { href: '/suppliers', label: t('suppliers'), icon: <Truck className="h-4 w-4" /> },
        { href: '/purchase-orders', label: t('purchaseOrders'), icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Clientes',
      items: [
        { href: '/customers', label: t('customers'), icon: <Users2 className="h-4 w-4" /> },
        { href: '/early-access', label: t('earlyAccess'), icon: <Mail className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Contenido',
      items: [
        { href: '/guides', label: t('guides'), icon: <BookOpen className="h-4 w-4" /> },
        { href: '/guide-categories', label: t('guideCategories'), icon: <FolderOpen className="h-4 w-4" /> },
        { href: '/carousels', label: t('carousels'), icon: <Images className="h-4 w-4" /> },
        { href: '/media', label: t('mediaGallery'), icon: <ImageIcon className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { href: '/external-trending', label: t('trending'), icon: <TrendingUp className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Analítica',
      items: [
        { href: '/search-analytics', label: t('searchAnalytics'), icon: <Search className="h-4 w-4" /> },
        { href: '/analytics', label: t('analytics'), icon: <LineChart className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Administración',
      items: [
        { href: '/stores', label: t('stores'), icon: <Store className="h-4 w-4" /> },
        { href: '/pickup-locations', label: t('pickupLocations'), icon: <MapPin className="h-4 w-4" /> },
        { href: '/timelines', label: t('timelines'), icon: <Clock className="h-4 w-4" /> },
        { href: '/admin-users', label: t('adminUsers'), icon: <UserCog className="h-4 w-4" /> },
        { href: '#', label: t('settings'), icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs overflow-y-auto">
        <nav className="grid gap-1 pb-6 text-sm">
          <Link
            href="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary overflow-hidden mb-3"
          >
            <Image
              src={LOGO_URL}
              alt="Joby's"
              width={130}
              height={59}
              className="h-6 w-auto transition-all group-hover:scale-110"
            />
            <span className="sr-only">Joby&apos;s</span>
          </Link>
          <Link href="/" className={lc}>
            <Home className="h-4 w-4" />
            {t('dashboard')}
          </Link>
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mt-4 mb-1 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={lc}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}


function DashboardBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {/* <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="#">Products</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>All Products</BreadcrumbPage>
        </BreadcrumbItem> */}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
