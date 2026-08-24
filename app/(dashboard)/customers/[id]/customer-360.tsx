'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, ShoppingBag, Heart, ShoppingCart, Mail, Phone, MapPin, Globe, Tag, StickyNote, X, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string | null;
    avatar: string | null;
    newsletter: boolean | null;
    notifications: boolean | null;
    preferredLanguage: string | null;
    preferredCurrency: string | null;
    favoriteGameCategories: string[];
    createdAt: string;
    addresses: Array<{
      id: string;
      label: string | null;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      country: string;
    }>;
    orders: Array<{
      id: string;
      status: string;
      total: number;
      currency: string;
      createdAt: string;
      itemCount: number;
      items: Array<{ sku: string; name: string; quantity: number; unitPrice: number }>;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      title: string;
      comment: string;
      createdAt: string;
      productName: string;
      sku: string;
    }>;
    recentEvents: Array<{ eventType: string; occurredAt: string; pagePath: string | null }>;
    eventCounts: Record<string, number>;
    wishlistCount: number;
    cartTotal: number;
    cartItemCount: number;
    cartCurrency: string;
  };
  metrics: {
    ltv: number;
    orderCount: number;
    aov: number;
    avgDaysBetween: number | null;
    daysSinceLast: number | null;
  };
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  segment: string;
  segmentLabel: string;
  segmentColor: string;
  churnRisk: 'low' | 'medium' | 'high';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (diff < 1) return 'hoy';
  if (diff < 2) return 'ayer';
  if (diff < 7) return `hace ${Math.floor(diff)} días`;
  if (diff < 30) return `hace ${Math.floor(diff / 7)} sem.`;
  if (diff < 365) return `hace ${Math.floor(diff / 30)} meses`;
  return `hace ${Math.floor(diff / 365)} años`;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-emerald-100 text-emerald-800',
  cancelled:  'bg-red-100 text-red-800',
};

const ORDER_STATUS_ES: Record<string, string> = {
  pending:    'Pendiente',
  confirmed:  'Confirmado',
  processing: 'En proceso',
  shipped:    'Enviado',
  delivered:  'Entregado',
  cancelled:  'Cancelado',
};

const EVENT_LABELS: Record<string, string> = {
  page_view:           'Vista de página',
  product_view:        'Vio producto',
  add_to_cart:         'Agregó al carro',
  purchase:            'Compra',
  search_performed:    'Búsqueda',
  begin_checkout:      'Inició checkout',
  login:               'Inicio de sesión',
  signup:              'Registro',
  match_tool_start:    'Usó Match Tool',
};

const CHURN_CONFIG = {
  low:    { label: 'Bajo', color: 'text-emerald-600', Icon: CheckCircle },
  medium: { label: 'Medio', color: 'text-amber-600',  Icon: AlertTriangle },
  high:   { label: 'Alto',  color: 'text-red-600',    Icon: TrendingDown },
};

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function useLocalNotes(customerId: string) {
  const key = `customer-notes-${customerId}`;
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setNotes(localStorage.getItem(key) ?? '');
  }, [key]);
  function save(val: string) {
    setNotes(val);
    localStorage.setItem(key, val);
  }
  return { notes, save };
}

function useLocalTags(customerId: string) {
  const key = `customer-tags-${customerId}`;
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    try {
      setTags(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      setTags([]);
    }
  }, [key]);
  function addTag(tag: string) {
    const next = [...new Set([...tags, tag.trim()])].filter(Boolean);
    setTags(next);
    localStorage.setItem(key, JSON.stringify(next));
  }
  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    localStorage.setItem(key, JSON.stringify(next));
  }
  return { tags, addTag, removeTag };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
        />
      ))}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Customer360({ customer, metrics, firstOrderDate, lastOrderDate, segment, segmentLabel, segmentColor, churnRisk }: Props) {
  const { notes, save: saveNotes } = useLocalNotes(customer.id);
  const { tags, addTag, removeTag } = useLocalTags(customer.id);
  const [tagInput, setTagInput] = useState('');

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—';
  const initials = [customer.firstName?.[0], customer.lastName?.[0]].filter(Boolean).join('').toUpperCase() || customer.email[0].toUpperCase();
  const churn = CHURN_CONFIG[churnRisk];
  const ChurnIcon = churn.Icon;

  function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (tagInput.trim()) { addTag(tagInput); setTagInput(''); }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/customers"><ArrowLeft className="h-4 w-4 mr-1.5" />Clientes</Link>
        </Button>
        <div className="flex flex-1 items-start gap-4 min-w-0">
          {/* Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight truncate">{fullName}</h1>
              <Badge className={segmentColor}>{segmentLabel}</Badge>
              <span className={`flex items-center gap-1 text-sm font-medium ${churn.color}`}>
                <ChurnIcon className="h-4 w-4" />
                Riesgo de abandono: {churn.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>
              {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Cliente desde {fmtDate(customer.createdAt)}</span>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {tag}
                  <button onClick={() => removeTag(tag)} aria-label={`Quitar etiqueta ${tag}`}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              ))}
              <form onSubmit={handleAddTag} className="flex items-center gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="+ etiqueta"
                  className="h-6 w-28 text-xs px-2 rounded-full border-dashed"
                  aria-label="Nueva etiqueta"
                />
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="LTV" value={fmt(metrics.ltv)} sub="pedidos completados" />
        <KpiCard label="AOV" value={fmt(metrics.aov)} sub="por pedido" />
        <KpiCard label="Pedidos" value={String(metrics.orderCount)} sub={firstOrderDate ? `desde ${fmtDate(firstOrderDate)}` : undefined} />
        <KpiCard
          label="Frecuencia"
          value={metrics.avgDaysBetween !== null ? `${metrics.avgDaysBetween}d` : '—'}
          sub="días entre pedidos"
        />
        <KpiCard
          label="Último pedido"
          value={lastOrderDate ? fmtRelative(lastOrderDate) : '—'}
          sub={lastOrderDate ? fmtDate(lastOrderDate) : undefined}
        />
        <KpiCard
          label="Carrito activo"
          value={customer.cartItemCount > 0 ? fmt(customer.cartTotal, customer.cartCurrency) : '—'}
          sub={customer.cartItemCount > 0 ? `${customer.cartItemCount} ítem(s)` : 'vacío'}
        />
      </div>

      {/* ── Body ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">
                Pedidos <Badge variant="secondary" className="ml-1.5 text-xs">{metrics.orderCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
              {customer.reviews.length > 0 && (
                <TabsTrigger value="reviews">
                  Reseñas <Badge variant="secondary" className="ml-1.5 text-xs">{customer.reviews.length}</Badge>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Orders tab */}
            <TabsContent value="orders">
              <Card>
                <CardContent className="p-0">
                  {customer.orders.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground text-sm">Sin pedidos aún.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Ítems</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Link href={`/orders/${order.id}`} className="font-mono text-xs hover:underline text-indigo-700">
                                #{order.id.slice(0, 8)}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${ORDER_STATUS_COLORS[order.status] ?? ''}`}>
                                {ORDER_STATUS_ES[order.status] ?? order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {fmt(order.total, order.currency)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {order.itemCount}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtDate(order.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity tab */}
            <TabsContent value="activity">
              <div className="space-y-4">
                {/* Event summary grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { key: 'product_view', label: 'Vistas producto', Icon: ShoppingBag },
                    { key: 'search_performed', label: 'Búsquedas', Icon: TrendingUp },
                    { key: 'add_to_cart', label: 'Al carro', Icon: ShoppingCart },
                    { key: 'purchase', label: 'Compras', Icon: CheckCircle },
                  ].map(({ key, label, Icon }) => (
                    <Card key={key}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-xl font-bold">{customer.eventCounts[key] ?? 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recent events timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Últimos 50 eventos</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-72 overflow-y-auto">
                      {customer.recentEvents.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Sin eventos registrados.</p>
                      ) : (
                        <div className="divide-y">
                          {customer.recentEvents.map((ev, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                <span className="font-medium">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
                                {ev.pagePath && (
                                  <span className="text-xs text-muted-foreground truncate max-w-40">{ev.pagePath}</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{fmtRelative(ev.occurredAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Reviews tab */}
            {customer.reviews.length > 0 && (
              <TabsContent value="reviews">
                <Card>
                  <CardContent className="p-0 divide-y">
                    {customer.reviews.map((r) => (
                      <div key={r.id} className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{r.productName}</p>
                            <p className="text-xs text-muted-foreground">{r.sku}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StarRating rating={r.rating} />
                            <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                          </div>
                        </div>
                        <p className="font-semibold text-sm">{r.title}</p>
                        <p className="text-sm text-muted-foreground">{r.comment}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* RFM profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Perfil RFM
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <RfmBar label="Recencia" value={metrics.daysSinceLast} unit="días" lowerIsBetter />
              <RfmBar label="Frecuencia" value={metrics.orderCount} unit="pedidos" />
              <RfmBar label="Monetario" value={metrics.ltv} unit="CLP" isMonetary currency="CLP" />
              <div className="pt-1 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Riesgo de abandono</span>
                  <span className={`font-semibold ${churn.color}`}>{churn.label}</span>
                </div>
                {metrics.avgDaysBetween && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Ciclo habitual</span>
                    <span>{metrics.avgDaysBetween} días</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" /> Preferencias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Idioma" value={customer.preferredLanguage?.toUpperCase() ?? '—'} />
              <Row label="Moneda" value={customer.preferredCurrency ?? '—'} />
              <Row label="Newsletter" value={customer.newsletter ? 'Sí' : 'No'} />
              <Row label="Wishlist" value={`${customer.wishlistCount} ítem(s)`} />
              {customer.favoriteGameCategories.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Categorías favoritas</p>
                  <div className="flex flex-wrap gap-1">
                    {customer.favoriteGameCategories.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          {customer.addresses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Direcciones ({customer.addresses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="text-xs text-muted-foreground">
                    {addr.label && <span className="font-medium text-foreground block">{addr.label}</span>}
                    <span>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</span>
                    <span className="block">{addr.city}{addr.region ? `, ${addr.region}` : ''} · {addr.country}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes — stored in localStorage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Notas internas
              </CardTitle>
              <CardDescription className="text-xs">Guardadas localmente en este navegador</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => saveNotes(e.target.value)}
                placeholder="Agrega notas sobre este cliente…"
                className="min-h-24 text-sm resize-none"
                aria-label="Notas internas del cliente"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RfmBar({
  label,
  value,
  unit,
  lowerIsBetter = false,
  isMonetary = false,
  currency,
}: {
  label: string;
  value: number | null;
  unit: string;
  lowerIsBetter?: boolean;
  isMonetary?: boolean;
  currency?: string;
}) {
  if (value === null) return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">—</span>
    </div>
  );

  const display = isMonetary && currency
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
    : `${value} ${unit}`;

  const Icon = lowerIsBetter
    ? value > 90 ? TrendingDown : value > 30 ? Minus : TrendingUp
    : value >= 5 ? TrendingUp : value >= 2 ? Minus : TrendingDown;

  const color = lowerIsBetter
    ? value > 90 ? 'text-red-500' : value > 30 ? 'text-amber-500' : 'text-emerald-500'
    : value >= 5 ? 'text-emerald-500' : value >= 2 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {display}
      </span>
    </div>
  );
}
