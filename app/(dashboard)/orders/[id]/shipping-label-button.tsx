'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ShippingLabelData = {
  orderId: string;
  recipient: string;
  phone: string | null;
  addressLines: string[];
  date: string;
  itemCount: number;
  siteUrl: string;
  logoDataUrl: string | null;
};

export function ShippingLabelButton({ data }: { data: ShippingLabelData }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')]);
      const orderNumber = data.orderId.slice(0, 8).toUpperCase();
      const qr = await QRCode.toDataURL(orderNumber, { margin: 1, width: 400 });
      const siteQr = await QRCode.toDataURL(data.siteUrl, { margin: 1, width: 300 });

      // 4x6in (10x15cm) thermal-style label
      const doc = new jsPDF({ unit: 'mm', format: [100, 150] });
      const w = 100;
      const m = 6;
      doc.setLineWidth(0.6);
      doc.rect(3, 3, w - 6, 144);

      if (data.logoDataUrl) {
        const props = doc.getImageProperties(data.logoDataUrl);
        const h = 12;
        const lw = Math.min((props.width / props.height) * h, 50);
        doc.addImage(data.logoDataUrl, props.fileType, m, 6, lw, lw / (props.width / props.height));
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Jobys', m, 14);
      }
      doc.addImage(siteQr, 'PNG', w - m - 13, 5, 13, 13);
      doc.line(3, 20, w - 3, 20);

      doc.setFontSize(8);
      doc.text('DESTINATARIO', m, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      const nameLines = doc.splitTextToSize(data.recipient, w - 2 * m) as string[];
      doc.text(nameLines.slice(0, 2), m, 32);
      let y = 32 + Math.min(nameLines.length, 2) * 7;

      doc.setFontSize(12);
      for (const line of data.addressLines) {
        for (const part of doc.splitTextToSize(line, w - 2 * m) as string[]) {
          doc.text(part, m, y);
          y += 6;
        }
      }
      doc.setFont('helvetica', 'normal');
      if (data.phone) {
        y += 1;
        doc.setFontSize(11);
        doc.text(`Tel: ${data.phone}`, m, y);
      }

      doc.line(3, 98, w - 3, 98);
      doc.addImage(qr, 'PNG', m, 102, 38, 38);
      doc.setFontSize(8);
      doc.text('Nº de pedido', m + 42, 108);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Pedido #${orderNumber}`, m + 42, 116);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Fecha: ${data.date}`, m + 42, 123);
      doc.text(`Bultos/items: ${data.itemCount}`, m + 42, 129);
      doc.text(data.siteUrl.replace(/^https?:\/\//, ''), m + 42, 137);

      doc.save(`etiqueta-${data.orderId.slice(0, 8)}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy}>
      <Printer className="w-4 h-4 mr-2" />
      {busy ? 'Generando…' : 'Etiqueta PDF'}
    </Button>
  );
}
