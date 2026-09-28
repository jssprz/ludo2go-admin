type OrderAmounts = {
  subtotal: number;
  tax: number;
  shipping: number;
  items: ReadonlyArray<{ discount: number }>;
};

export function calculatePurchaseOrderTotals(
  gross: number,
  discount: number,
  shipping: number,
  includeShippingInTax: boolean,
  discountAfterTax: boolean
) {
  const subtotal = gross - discount;
  const taxBase = (discountAfterTax ? gross : subtotal) + (includeShippingInTax ? shipping : 0);
  const tax = Math.round(taxBase * 0.19);
  return { subtotal, tax, total: subtotal + shipping + tax };
}

export function inferPurchaseOrderTaxOptions(order: OrderAmounts) {
  const discount = order.items.reduce((sum, item) => sum + item.discount, 0);
  const gross = order.subtotal + discount;
  const options = [
    { includeShippingInTax: false, discountAfterTax: false },
    { includeShippingInTax: true, discountAfterTax: false },
    { includeShippingInTax: false, discountAfterTax: true },
    { includeShippingInTax: true, discountAfterTax: true },
  ];
  return options.find((option) =>
    calculatePurchaseOrderTotals(gross, discount, order.shipping, option.includeShippingInTax, option.discountAfterTax).tax === order.tax
  ) ?? options[0];
}