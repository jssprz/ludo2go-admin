import 'server-only';

import { prisma } from '@jssprz/ludo2go-database';
import { Resend } from 'resend';
import type { CartActivityCounts } from './cart-activity';

type CartAbandonmentReport = {
  startedAt: Date;
  completedAt: Date;
  cutoff: Date;
  counts: CartActivityCounts | null;
};

export async function sendCartAbandonmentReport(report: CartAbandonmentReport): Promise<number> {
  const admins = await prisma.adminUser.findMany({
    where: { email: { not: '' } },
    select: { email: true },
  });
  const recipients = Array.from(new Set(admins.map((admin) => admin.email.trim()).filter(Boolean)));
  if (!recipients.length) throw new Error('No admin email recipients are configured.');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const failed = report.counts === null;
  const formatDate = (date: Date) => new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: 'America/Santiago',
  }).format(date);
  const lines = [
    `Estado: ${failed ? 'Fallido' : 'Completado'}`,
    `Inicio: ${formatDate(report.startedAt)}`,
    `Fin: ${formatDate(report.completedAt)}`,
    `Corte de inactividad (30 días): ${formatDate(report.cutoff)}`,
    report.counts === null
      ? 'No se pudieron determinar los números de carritos. Revisar los registros del servidor.'
      : [
        `Carritos activos: ${report.counts.active}`,
        `  Clientes: ${report.counts.customers.active}`,
        `  Visitantes anónimos: ${report.counts.anonymousVisitors.active}`,
        `Carritos abandonados: ${report.counts.abandoned}`,
        `  Clientes: ${report.counts.customers.abandoned}`,
        `  Visitantes anónimos: ${report.counts.anonymousVisitors.abandoned}`,
        `Total de carritos no ordenados: ${report.counts.active + report.counts.abandoned}`,
      ].join('\n'),
    'Clientes: carritos con cliente asignado o visitante identificado con un único cliente. Los demás se cuentan como visitantes anónimos, incluidos los carritos sin propietario identificable.',
    'Informe de solo lectura: no se modifica el estado de ningún carrito. Los carritos ordenados se excluyen.',
    'Un carrito se considera abandonado después de 30 días sin cambios en el carrito ni en sus artículos, independientemente de su estado activo o abandonado guardado.',
  ];
  const resend = new Resend(apiKey);
  const results = await Promise.all(recipients.map((to) => resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Jobys Reports <reports@jobys.cl>',
    to,
    subject: `Jobys: informe de actividad de carritos - ${failed ? 'fallido' : `${report.counts?.active} activos / ${report.counts?.abandoned} abandonados`}`,
    text: lines.join('\n'),
    tags: [{ name: 'type', value: 'cart_abandonment_report' }],
  })));
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new Error(`Cart abandonment report email failed: ${failure.message}`);
  return recipients.length;
}
