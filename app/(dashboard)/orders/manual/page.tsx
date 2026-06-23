'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  DollarSign,
  User,
} from 'lucide-react';

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Variant = {
  id: string;
  sku: string;
  product: {
    id: string;
    name: string;
  };
};

type OrderItem = {
  variantId: string;
  variant?: Variant;
  quantity: number;
  unitPrice: number;
};

const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'check', 'other'] as const;

export default function ManualOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<'customer' | 'items' | 'payment' | 'review'>('customer');

  // Customer state
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Items state
  const [items, setItems] = useState<OrderItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [searchingVariants, setSearchingVariants] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<{ variantId: string; quantity: number; unitPrice: number }>({
    variantId: '',
    quantity: 1,
    unitPrice: 0,
  });

  // Order state
  const [currency, setCurrency] = useState('CLP');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search customers
  async function handleCustomerSearch(query: string) {
    setCustomerSearch(query);
    if (query.length < 2) {
      setCustomers([]);
      return;
    }

    setSearchingCustomers(true);
    try {
      const res = await fetch(`/api/customers/search?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerId(customer.id);
    setCustomerSearch('');
    setCustomers([]);
  }

  // Search variants
  async function handleVariantSearch(query: string) {
    setVariantSearch(query);
    if (query.length < 2) {
      setVariants([]);
      return;
    }

    setSearchingVariants(true);
    try {
      const res = await fetch(`/api/variants/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setVariants(Array.isArray(data) ? data : data.variants || []);
      }
    } catch (error) {
      console.error('Error searching variants:', error);
    } finally {
      setSearchingVariants(false);
    }
  }

  function addItem() {
    if (!newItem.variantId) {
      alert('Please select a variant');
      return;
    }
    if (newItem.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    const variant = variants.find((v) => v.id === newItem.variantId);
    setItems([
      ...items,
      {
        ...newItem,
        variant,
      },
    ]);
    setNewItem({ variantId: '', quantity: 1, unitPrice: 0 });
    setVariantSearch('');
    setVariants([]);
    setShowAddItem(false);
  }

  function removeItem(variantId: string) {
    setItems(items.filter((item) => item.variantId !== variantId));
  }

  function updateItem(variantId: string, field: string, value: any) {
    setItems(
      items.map((item) =>
        item.variantId === variantId ? { ...item, [field]: value } : item
      )
    );
  }

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = Math.round(subtotal * 0.19);
  const total = subtotal + tax + shipping - discount;

  // Handle submit
  async function handleCreateOrder() {
    if (!selectedCustomer || items.length === 0) {
      alert('Please select a customer and add items');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          subtotal,
          tax,
          shipping,
          discount,
          total,
          currency,
          paymentMethod: paymentMethod || null,
          paymentStatus: paymentMethod ? 'completed' : null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to create order');
      }

      const order = await res.json();
      router.push(`/orders/${order.id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Register Manual Order</h1>
        <p className="text-muted-foreground">
          Create a new order manually by selecting a customer, adding items, and specifying payment details.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2">
        {(['customer', 'items', 'payment', 'review'] as const).map((s, idx) => (
          <Button
            key={s}
            variant={step === s ? 'default' : 'outline'}
            onClick={() => setStep(s)}
            disabled={
              (s === 'items' && !selectedCustomer) ||
              (s === 'payment' && items.length === 0) ||
              (s === 'review' && !paymentMethod)
            }
          >
            {idx + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Step 1: Customer Selection */}
      {step === 'customer' && (
        <Card>
          <CardHeader>
            <CardTitle>Select or Create Customer</CardTitle>
            <CardDescription>Find existing customer or create a new one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5" />
                  <div>
                    <p className="font-medium">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerId('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Search Customer</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email, name..."
                      value={customerSearch}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {searchingCustomers && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}

                {customers.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </button>
                    ))}
                  </div>
                )}

                {customerSearch && customers.length === 0 && !searchingCustomers && (
                  <div className="p-4 text-center text-muted-foreground">
                    No customers found. Consider creating a new one.
                  </div>
                )}
              </>
            )}

            <Button
              onClick={() => setStep('items')}
              disabled={!selectedCustomer}
              className="w-full"
            >
              Continue to Items
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Items */}
      {step === 'items' && (
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Add products to the order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.variantId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.variant?.product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.variant?.sku}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.variantId, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-16 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(item.variantId, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(item.quantity * item.unitPrice).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No items added yet. Click "Add Item" to start.
              </div>
            )}

            <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
              <Button onClick={() => setShowAddItem(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Item to Order</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Product Variant</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by product name or SKU..."
                        value={variantSearch}
                        onChange={(e) => handleVariantSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>

                    {searchingVariants && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}

                    {variants.length > 0 && (
                      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                        {variants.map((variant) => (
                          <button
                            key={variant.id}
                            onClick={() => {
                              setNewItem({ ...newItem, variantId: variant.id });
                              setVariantSearch('');
                              setVariants([]);
                            }}
                            className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{variant.product.name}</p>
                              <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {newItem.variantId && (
                    <>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e) =>
                            setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newItem.unitPrice}
                          onChange={(e) =>
                            setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddItem(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addItem} disabled={!newItem.variantId}>
                    Add Item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => setStep('payment')}
              disabled={items.length === 0}
              className="w-full"
            >
              Continue to Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment Details */}
      {step === 'payment' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment & Shipping</CardTitle>
            <CardDescription>Configure payment method, discounts, and shipping</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLP">CLP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping</Label>
                <Input
                  type="number"
                  min="0"
                  value={shipping}
                  onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Tax (19%)</Label>
                <Input disabled value={tax} className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this order..."
                rows={3}
              />
            </div>

            <Button
              onClick={() => setStep('review')}
              disabled={!paymentMethod}
              className="w-full"
            >
              Review Order
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 'review' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            {/* Customer Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{selectedCustomer?.email}</p>
              </CardContent>
            </Card>

            {/* Items Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.variant?.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x @ {item.unitPrice.toLocaleString()}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {(item.quantity * item.unitPrice).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (19%):</span>
                <span>{tax.toLocaleString()}</span>
              </div>
              {shipping > 0 && (
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span>{shipping.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-3 font-bold flex justify-between text-base">
                <span>Total:</span>
                <span>{total.toLocaleString()}</span>
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Payment Method:</span> {paymentMethod}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Currency:</span> {currency}
                </p>
              </div>

              <Button
                onClick={handleCreateOrder}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Order'
                )}
              </Button>

              <Button variant="outline" onClick={() => setStep('payment')} className="w-full">
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
