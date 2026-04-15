import Link from 'next/link';
import {
  Home,
  LineChart,
  Package,
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
  Store,
  Truck,
  ClipboardList,
  CalendarPlus,
  TrendingUp,
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
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-1 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base overflow-hidden"
        >
          <Image
            src={LOGO_URL}
            alt="Joby's"
            width={130}
            height={59}
            className="h-5 w-auto transition-all group-hover:scale-110"
          />
          <span className="sr-only">Jobys</span>
        </Link>

        <NavItem href="/" label="Dashboard">
          <Home className="h-4 w-4" />
        </NavItem>

        <NavItem href="/orders" label={t('orders')}>
          <ShoppingCart className="h-4 w-4" />
        </NavItem>

        <NavItem href="/products" label={t('products')}>
          <Package className="h-4 w-4" />
        </NavItem>

        <NavItem href="/presale" label="Pre-Sale">
          <CalendarPlus className="h-4 w-4" />
        </NavItem>

        <NavItem href="/brands" label={t('brands')}>
          <Tag className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-categories" label={t('gameCategories')}>
          <Gamepad2 className="h-4 w-4" />
        </NavItem>

        <NavItem href="/accessory-categories" label={t('accessoryCategories')}>
          <Puzzle className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-themes" label={t('gameThemes')}>
          <Palette className="h-4 w-4" />
        </NavItem>

        <NavItem href="/game-mechanics" label={t('gameMechanics')}>
          <Wrench className="h-4 w-4" />
        </NavItem>

        <NavItem href="/inventory" label={t('inventory')}>
          <Boxes className="h-4 w-4" />
        </NavItem>

        <NavItem href="/locations" label={t('locations')}>
          <Warehouse className="h-4 w-4" />
        </NavItem>

        <NavItem href="/stores" label={t('stores')}>
          <Store className="h-4 w-4" />
        </NavItem>

        <NavItem href="/suppliers" label="Suppliers">
          <Truck className="h-4 w-4" />
        </NavItem>

        <NavItem href="/purchase-orders" label="Purchase Orders">
          <ClipboardList className="h-4 w-4" />
        </NavItem>

        <NavItem href="/customers" label={t('customers')}>
          <Users2 className="h-4 w-4" />
        </NavItem>

        <NavItem href="/timelines" label={t('timelines')}>
          <Clock className="h-4 w-4" />
        </NavItem>

        <NavItem href="/pickup-locations" label={t('pickupLocations')}>
          <MapPin className="h-4 w-4" />
        </NavItem>

        <NavItem href="/carousels" label={t('carousels')}>
          <ImageIcon className="h-4 w-4" />
        </NavItem>

        <NavItem href="/early-access" label={t('earlyAccess')}>
          <Mail className="h-4 w-4" />
        </NavItem>

        <NavItem href="/media" label={t('mediaGallery')}>
          <Images className="h-4 w-4" />
        </NavItem>

        <NavItem href="/external-trending" label="Trending">
          <TrendingUp className="h-4 w-4" />
        </NavItem>

        <NavItem href="#" label={t('analytics')}>
          <LineChart className="h-4 w-4" />
        </NavItem>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <NavItem href="/admin-users" label={t('adminUsers')}>
          <UserCog className="h-4 w-4" />
        </NavItem>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="#"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">{t('settings')}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{t('settings')}</TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs">
        <nav className="grid gap-6 text-lg font-medium">
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
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/orders"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
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
            href="/presale"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <CalendarPlus className="h-4 w-4" />
            Pre-Sale
          </Link>
          <Link
            href="/brands"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Tag className="h-4 w-4" />
            Brands
          </Link>
          <Link
            href="/game-categories"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Gamepad2 className="h-4 w-4" />
            Game Categories
          </Link>
          <Link
            href="/accessory-categories"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Puzzle className="h-4 w-4" />
            Accessory Categories
          </Link>
          <Link
            href="/game-themes"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Palette className="h-4 w-4" />
            Game Themes
          </Link>
          <Link
            href="/game-mechanics"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Wrench className="h-4 w-4" />
            Game Mechanics
          </Link>
          <Link
            href="/inventory"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Boxes className="h-4 w-4" />
            Inventory
          </Link>
          <Link
            href="/locations"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Warehouse className="h-4 w-4" />
            Locations
          </Link>
          <Link
            href="/stores"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Store className="h-4 w-4" />
            Stores
          </Link>
          <Link
            href="/suppliers"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Truck className="h-4 w-4" />
            Suppliers
          </Link>
          <Link
            href="/purchase-orders"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <ClipboardList className="h-4 w-4" />
            Purchase Orders
          </Link>
          <Link
            href="#"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Users2 className="h-4 w-4" />
            Customers
          </Link>
          <Link
            href="/timelines"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-4 w-4" />
            Timelines
          </Link>
          <Link
            href="/pickup-locations"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <MapPin className="h-4 w-4" />
            Pickup Locations
          </Link>
          <Link
            href="/carousels"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <ImageIcon className="h-4 w-4" />
            Carousels
          </Link>
          <Link
            href="/early-access"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            Early Access
          </Link>
          <Link
            href="/media"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Images className="h-4 w-4" />
            Media Gallery
          </Link>
          <Link
            href="/external-trending"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </Link>
          <Link
            href="/admin-users"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
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
