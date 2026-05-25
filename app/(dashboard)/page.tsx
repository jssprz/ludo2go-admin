import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, Users, PlusCircle, LineChart, Workflow } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@jssprz/ludo2go-database';
import { OrderStatus, EventType, DeviceType } from '@prisma/client';
import { getLocale, getTranslations } from 'next-intl/server';

const formatPrice = (price: number, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(price)
}

export default async function AdminHomePage() {
  const t = await getTranslations('dashboard');
  const tp = await getTranslations('products');
  const td = await getTranslations('dashboardPage');
  const locale = await getLocale();
  
  // get totals
  let totalProducts = await prisma.product.count();
  let totalVairants = await prisma.productVariant.count();
  let totalGames = await prisma.gameDetails.count();
  let totalExpansions = await prisma.gameExpansionDetails.count();
  let totalAccessories = await prisma.accessoryDetails.count();
  let totalBundles = await prisma.bundleDetails.count();
  let totalCustomers = await prisma.customer.count();
  let totalAddresses = await prisma.address.count();
  let totalOrders = await prisma.order.count();
  let totalPendingOrders = (await prisma.order.findMany({ where: { status: OrderStatus.pending } })).length
  let totalProcessingOrders = (await prisma.order.findMany({ where: { status: OrderStatus.processing } })).length
  let totalShippedOrders = (await prisma.order.findMany({ where: { status: OrderStatus.shipped } })).length
  let totalDeliveredOrders = (await prisma.order.findMany({ where: { status: OrderStatus.delivered } })).length
  let totalCancelledOrders = (await prisma.order.findMany({ where: { status: OrderStatus.cancelled } })).length

  // get averages
  let variants = (await prisma.productVariant.findMany({ include: { prices: true }, where: { prices: { some: {} } } }))
  let avgVariantPrice = variants.length ? variants.map((v) => v.prices[0].amount).reduce((sum, value) => sum + value, 0) / variants.length : 0

  let orders = (await prisma.order.findMany({ include: { items: true } }))
  let avgOrderSize = orders.length ? orders.map((o) => o.items.length).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderSubtotal = orders.length ? orders.map((o) => o.subtotal).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderShipping = orders.length ? orders.map((o) => o.shipping).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderTotal = orders.length ? orders.map((o) => o.total).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgCustomerSpent = totalCustomers ? orders.map((o) => o.total).reduce((sum, value) => sum + value, 0) / totalCustomers : 0

  // events
  let avgCustomerVisits = totalCustomers ? (await prisma.event.groupBy({ by: ['sessionId'], where: { customerId: { not: null }, }, _count: { _all: true, }, })).map((g) => g._count._all).reduce((sum, value) => sum + value, 0) / totalCustomers : 0
  let totalDesktopVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: DeviceType.desktop } })).length
  let totalMobileVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: DeviceType.mobile } })).length
  let totalOtherVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: { notIn: [DeviceType.mobile, DeviceType.desktop] } } })).length
  let desktopPurchases = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.purchase } })).length
  let mobilePurchases = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.purchase } })).length
  let desktopAtoC = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.add_to_cart } })).length
  let mobileAtoC = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.add_to_cart } })).length
  let desktopSearches = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.search_performed } })).length
  let mobileSearches = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.search_performed } })).length
  let desktopProductImprs = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.product_impression } })).length
  let mobileProductImprs = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.product_impression } })).length
  let desktopConversion = totalDesktopVisits ? desktopPurchases / totalDesktopVisits : 0
  let mobileConversion = totalMobileVisits ? mobilePurchases / totalMobileVisits : 0
  let desktopAtoCsRate = totalDesktopVisits ? desktopAtoC / totalDesktopVisits : 0
  let mobileAtoCsRate = totalMobileVisits ? mobileAtoC / totalMobileVisits : 0
  let avgDesktopProductImprs = totalVairants ? desktopProductImprs / totalVairants : 0
  let avgMobileProductImprs = totalVairants ? mobileProductImprs / totalVairants : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {tp('addProduct')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Catalog */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('catalog.title')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.products')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalVairants}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.variants')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgVariantPrice, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.avgPrice')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalGames}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.games')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalExpansions}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.games')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAccessories}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.accessories')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalBundles}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.bundles')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Week Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('orders.title')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.total')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgOrderSize * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgSize')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderSubtotal, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgSubtotal')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderShipping, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgShipping')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderTotal, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgTotal')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalPendingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.pending')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalProcessingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.processing')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalShippedOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.shipped')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalDeliveredOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.delivered')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalCancelledOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.cancelled')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('customers.title')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.total')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgCustomerVisits * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgVisits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(totalOrders / totalCustomers * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgOrders')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgCustomerSpent, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgSpent')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAddresses}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.addresses')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('mobileTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalMobileVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgMobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('desktopTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalDesktopVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other/Unknown Device Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('otherTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalOtherVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traffic per Channel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('utm.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM1
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM2
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM3
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM4
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM5
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  UTM6
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Catalog */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.catalog.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.catalog.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/products">{td('quick.catalog.viewProducts')}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/products?status=draft">{td('quick.catalog.draftProducts')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders & Customers */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.ordersCustomers.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.ordersCustomers.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.ordersCustomers.ordersComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.ordersCustomers.customersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.stockInventory.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.stockInventory.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.stockInventory.stockPerVariantComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.stockInventory.lowStockComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prices, promotions, and coupons */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.pricingPromotions.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description2')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description3')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description4')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.pricesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.promotionsComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.couponsComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.simpleRulesComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Logistics */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.shippingLogistics.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description2')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description3')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description4')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.shippingZonesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.ratesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.couriersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content & Pages (mini CMS) */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.contentPages.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.contentPages.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.contentPages.description2')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.contentPages.pagesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.contentPages.bannersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports & basic analytics */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.reportsAnalytics.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.reportsAnalytics.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.reportsAnalytics.description2')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.reportsAnalytics.salesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.reportsAnalytics.topProductsComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}