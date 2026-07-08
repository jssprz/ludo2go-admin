import Link from 'next/link';
import {
  Home,
  LineChart,
  Search,
  Package,
  PanelLeft,
  Settings,
  ShoppingCart,
  Users2,
  UserCheck,
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
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import Image from 'next/image';
import { Analytics } from '@vercel/analytics/react';
import { User } from './user';
import Providers from './providers';
import { NavItem } from './nav-item';
import { SearchInput } from './search';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getTranslations } from 'next-intl/server';

const LOGO_URL = `${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/assets/jobys-logo-130x59.png`;

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <main className="flex min-h-screen w-full flex-col bg-muted/40">
        <DesktopNav />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileNav />
            <DashboardBreadcrumb />
            <SearchInput />
            <LanguageSwitcher />
            <User />
          </header>
          <main className="grid flex-1 items-start gap-2 p-4 sm:px-6 sm:py-0 md:gap-4 bg-muted/40">
            {children}
          </main>
        </div>
        <Analytics />
      </main>
    </Providers>
  );
}

async function DesktopNav() {
  const t = await getTranslations('nav');
  return (
    <aside className="group fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background transition-all duration-200 hover:w-64 sm:flex">
      <nav className="flex min-h-0 flex-1 flex-col items-start gap-1 overflow-y-auto px-2 py-5">
        <Link
          href="/"
          className="group/logo flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base overflow-hidden"
        >
          <Image
            src={LOGO_URL}
            alt="Joby's"
            width={130}
            height={59}
            className="h-5 w-auto transition-all group-hover/logo:scale-110"
          />
          <span className="sr-only">Jobys</span>
        </Link>

        <NavItem href="/" label={t('dashboard')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Home className="h-4 w-4" />
        </NavItem>

        <NavItem href="/orders" label={t('orders')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <ShoppingCart className="h-4 w-4" />
        </NavItem>

        <NavItem href="/products" label={t('products')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Package className="h-4 w-4" />
        </NavItem>

        <NavItem href="/bundles" label="Bundles" expandedClassName="group-hover:justify-start group-hover:px-3">
          <Package className="h-4 w-4" />
        </NavItem>

        <NavItem href="/promo-codes" label="Promo Codes" expandedClassName="group-hover:justify-start group-hover:px-3">
          <Tag className="h-4 w-4" />
        </NavItem>

        <NavItem href="/presale" label="Pre-Sale" expandedClassName="group-hover:justify-start group-hover:px-3">
          <CalendarPlus className="h-4 w-4" />
        </NavItem>

        <NavItem href="/brands" label={t('brands')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Tag className="h-4 w-4" />
        </NavItem>

        <NavItem href="/recommendation-profiles" label={t('recommendationProfiles')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Sigma className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-categories" label={t('gameCategories')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Gamepad2 className="h-4 w-4" />
        </NavItem>

        <NavItem href="/accessory-categories" label={t('accessoryCategories')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Puzzle className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-themes" label={t('gameThemes')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Palette className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-mechanics" label={t('gameMechanics')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Wrench className="h-4 w-4" />
        </NavItem>

        <NavItem href="/guide-categories" label={t('guideCategories')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Tag className="h-4 w-4" />
        </NavItem>

        <NavItem href="/guides" label={t('guides')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <BookOpen className="h-4 w-4" />
        </NavItem>

        <NavItem href="/inventory" label={t('inventory')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Boxes className="h-4 w-4" />
        </NavItem>

        <NavItem href="/prices" label={t('prices')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Tag className="h-4 w-4" />
        </NavItem>

        <NavItem href="/locations" label={t('locations')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Warehouse className="h-4 w-4" />
        </NavItem>

        <NavItem href="/stores" label={t('stores')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Store className="h-4 w-4" />
        </NavItem>

        <NavItem href="/suppliers" label="Suppliers" expandedClassName="group-hover:justify-start group-hover:px-3">
          <Truck className="h-4 w-4" />
        </NavItem>

        <NavItem href="/purchase-orders" label="Purchase Orders" expandedClassName="group-hover:justify-start group-hover:px-3">
          <ClipboardList className="h-4 w-4" />
        </NavItem>

        <NavItem href="/customers" label={t('customers')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Users2 className="h-4 w-4" />
        </NavItem>

        <NavItem href="/timelines" label={t('timelines')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Clock className="h-4 w-4" />
        </NavItem>

        <NavItem href="/pickup-locations" label={t('pickupLocations')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <MapPin className="h-4 w-4" />
        </NavItem>

        <NavItem href="/carousels" label={t('carousels')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <ImageIcon className="h-4 w-4" />
        </NavItem>

        <NavItem href="/early-access" label={t('earlyAccess')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Mail className="h-4 w-4" />
        </NavItem>

        <NavItem href="/media" label={t('mediaGallery')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Images className="h-4 w-4" />
        </NavItem>

        <NavItem href="/external-trending" label="Trending" expandedClassName="group-hover:justify-start group-hover:px-3">
          <TrendingUp className="h-4 w-4" />
        </NavItem>

        <NavItem href="/search-analytics" label={t('searchAnalytics')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <Search className="h-4 w-4" />
        </NavItem>

        <NavItem href="#" label={t('analytics')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <LineChart className="h-4 w-4" />
        </NavItem>
      </nav>
      <nav className="flex flex-col items-start gap-4 border-t px-2 py-4">
        <NavItem href="/admin-users" label={t('adminUsers')} expandedClassName="group-hover:justify-start group-hover:px-3">
          <UserCog className="h-4 w-4" />
        </NavItem>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="#"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8 group-hover:w-full group-hover:justify-start group-hover:px-3"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">{t('settings')}</span>
              <span className="ml-2 hidden text-sm group-hover:inline">{t('settings')}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{t('settings')}</TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
}

function MobileNav() {
  const mobileLinkClassName = 'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground';
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs overflow-y-auto">
        <nav className="grid gap-3 pb-6 text-lg font-medium">
          <Link
            href="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base overflow-hidden"
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
          <Link
            href="/"
            className={mobileLinkClassName}
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/orders"
            className={mobileLinkClassName}
          >
            <ShoppingCart className="h-4 w-4" />
            Orders
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-4 px-2.5 text-foreground"
          >
            <Package className="h-4 w-4" />
            Products
          </Link>
          <Link
            href="/bundles"
            className={mobileLinkClassName}
          >
            <Package className="h-4 w-4" />
            Bundles
          </Link>
          <Link
            href="/promo-codes"
            className={mobileLinkClassName}
          >
            <Tag className="h-4 w-4" />
            Promo Codes
          </Link>
          <Link
            href="/presale"
            className={mobileLinkClassName}
          >
            <CalendarPlus className="h-4 w-4" />
            Pre-Sale
          </Link>
          <Link
            href="/brands"
            className={mobileLinkClassName}
          >
            <Tag className="h-4 w-4" />
            Brands
          </Link>
          <Link
            href="/game-categories"
            className={mobileLinkClassName}
          >
            <Gamepad2 className="h-4 w-4" />
            Game Categories
          </Link>
          <Link
            href="/accessory-categories"
            className={mobileLinkClassName}
          >
            <Puzzle className="h-4 w-4" />
            Accessory Categories
          </Link>
          <Link
            href="/game-themes"
            className={mobileLinkClassName}
          >
            <Palette className="h-4 w-4" />
            Game Themes
          </Link>
          <Link
            href="/game-mechanics"
            className={mobileLinkClassName}
          >
            <Wrench className="h-4 w-4" />
            Game Mechanics
          </Link>
          <Link
            href="/inventory"
            className={mobileLinkClassName}
          >
            <Boxes className="h-4 w-4" />
            Inventory
          </Link>
          <Link
            href="/prices"
            className={mobileLinkClassName}
          >
            <Tag className="h-4 w-4" />
            Prices
          </Link>
          <Link
            href="/locations"
            className={mobileLinkClassName}
          >
            <Warehouse className="h-4 w-4" />
            Locations
          </Link>
          <Link
            href="/stores"
            className={mobileLinkClassName}
          >
            <Store className="h-4 w-4" />
            Stores
          </Link>
          <Link
            href="/suppliers"
            className={mobileLinkClassName}
          >
            <Truck className="h-4 w-4" />
            Suppliers
          </Link>
          <Link
            href="/purchase-orders"
            className={mobileLinkClassName}
          >
            <ClipboardList className="h-4 w-4" />
            Purchase Orders
          </Link>
          <Link
            href="#"
            className={mobileLinkClassName}
          >
            <Users2 className="h-4 w-4" />
            Customers
          </Link>
          <Link
            href="/timelines"
            className={mobileLinkClassName}
          >
            <Clock className="h-4 w-4" />
            Timelines
          </Link>
          <Link
            href="/pickup-locations"
            className={mobileLinkClassName}
          >
            <MapPin className="h-4 w-4" />
            Pickup Locations
          </Link>
          <Link
            href="/carousels"
            className={mobileLinkClassName}
          >
            <ImageIcon className="h-4 w-4" />
            Carousels
          </Link>
          <Link
            href="/early-access"
            className={mobileLinkClassName}
          >
            <Mail className="h-4 w-4" />
            Early Access
          </Link>
          <Link
            href="/media"
            className={mobileLinkClassName}
          >
            <Images className="h-4 w-4" />
            Media Gallery
          </Link>
          <Link
            href="/external-trending"
            className={mobileLinkClassName}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </Link>
          <Link
            href="/search-analytics"
            className={mobileLinkClassName}
          >
            <Search className="h-4 w-4" />
            Search Analytics
          </Link>
          <Link
            href="/admin-users"
            className={mobileLinkClassName}
          >
            <UserCog className="h-4 w-4" />
            Admin Users
          </Link>
          <Link
            href="#"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <LineChart className="h-4 w-4" />
            Settings
          </Link>
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
