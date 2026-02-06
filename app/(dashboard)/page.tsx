import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, Users, PlusCircle, LineChart, Workflow } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@jssprz/ludo2go-database';
import { OrderStatus, EventType, DeviceType } from '@prisma/client';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(price)
}

export default async function AdminHomePage() {
  // get totals
  let totalProducts = await prisma.product.count();
  let totalVairants = await prisma.productVariant.count();
  let totalGames = await prisma.gameDetails.count();
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
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage catalog, stock, orders, shipping, and customers of the store.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Catalog */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catalog</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-3'>
              <div>
                <div className="text-xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  Products
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalVairants}</div>
                <p className="text-xs text-muted-foreground">
                  Variants
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgVariantPrice)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Price
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalGames}</div>
                <p className="text-xs text-muted-foreground">
                  Games
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAccessories}</div>
                <p className="text-xs text-muted-foreground">
                  Accesories
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalBundles}</div>
                <p className="text-xs text-muted-foreground">
                  Bundles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Week Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Total
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgOrderSize * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Size
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderSubtotal)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Subtotal
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderShipping)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Shipping
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderTotal)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Total
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalPendingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Pending
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalProcessingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Proceess
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalShippedOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Shipped
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalDeliveredOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Delivered
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalCancelledOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Cancelled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-3'>
              <div>
                <div className="text-xl font-bold">{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Total
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgCustomerVisits * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Visits
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(totalOrders / totalCustomers * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Orders
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgCustomerSpent)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Spent
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAddresses}</div>
                <p className="text-xs text-muted-foreground">
                  Addresses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mobile Traffic & Rates</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalMobileVisits}</div>
                <p className="text-xs text-muted-foreground">
                  Visits
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Conversion
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  AtoC
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileSearches}</div>
                <p className="text-xs text-muted-foreground">
                  Searches
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Item Imprs
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgMobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Item Imprs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desktop Traffic & Rates</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalDesktopVisits}</div>
                <p className="text-xs text-muted-foreground">
                  Visits
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Conversion
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  AtoC
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  Searches
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Item Imprs
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Item Imprs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other/Unknown Device Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desktop Traffic & Rates</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalOtherVisits}</div>
                <p className="text-xs text-muted-foreground">
                  Visits
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  Conversion
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  AtoC
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  Searches
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Item Imprs
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  Avg Item Imprs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traffic per Channel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traffic per UTM</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-6'>
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
            <CardTitle>Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create, edit and organize products and their variants.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/products">View products</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/products?status=draft">Draft products</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders & Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Orders & Customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Track orders, customers and fulfillment.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Orders (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Customers (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>Stock & Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Update stocks per variant and manage alerts.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Stock per variant (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Products at risk of running out of stock (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prices, promotions, and coupons */}
        <Card>
          <CardHeader>
            <CardTitle>Prices, Promotions & Coupons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Manage base price + sale price per variant, promotions and coupons.
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Schedule promotions by date (e.g., Black Friday, summer sales)
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Coupon management: percentage, fixed amount, free shipping, minimum order value, expiration.
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Simple rules such as: “X% off on the ‘family games’ category.”
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Prices (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Promotions (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Coupons (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Simple Rules (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Logistics */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping & Logistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Configuration of shipping zones (Chile: Metropolitan Region, other regions, remote areas, etc.)
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Rates: flat, by weight, by order total
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Integrations or at least data export for couriers (Chilexpress, Starken, etc.)
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Field for shipment tracking number and tracking link.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Shipping Zones (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Rates (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Couriers (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content & Pages (mini CMS) */}
        <Card>
          <CardHeader>
            <CardTitle>Content & Pages (mini CMS)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Edit key texts: return policy, terms and conditions, FAQs
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Banners and promotional messages on the home page (“Free shipping on orders over $X”)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Pages (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Banners (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports & basic analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Reports & basic analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              (Future sections) Even if you later use GA/Looker/etc., the admin should at least show:
            </p>
            <p className="text-sm text-muted-foreground">
              (Future sections) Banners and promotional messages on the home page (“Free shipping on orders over $X”)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                Sales per day / week / month (coming soon)
              </Button>
              <Button variant="outline" size="sm" disabled>
                Top best-selling products (coming soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}