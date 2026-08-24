import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@jssprz/ludo2go-database';
import { EventType } from '@prisma/client';
import { AlertTriangle, Smartphone, Monitor } from 'lucide-react';
import { PeriodSelector } from '../search-analytics/period-selector';

export const metadata = { title: 'Match Tool Analytics' };

const NOISE_LABELS = new Set(['continuar', 'continue', 'siguiente', 'next', 'skip', 'omitir', 'back', 'volver']);

function parseProps(raw: unknown): Record<string, unknown> | null {
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  } catch {}
  return null;
}

function pct(n: number, total: number) {
  if (total === 0) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

export default async function MatchToolAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const daysParam = sp?.days ? parseInt(sp.days) : null;
  const startDate = daysParam ? new Date(Date.now() - daysParam * 86_400_000) : null;
  const periodFilter = startDate ? { occurredAt: { gte: startDate } } : {};

  const matchToolEvents = await prisma.event.findMany({
    where: {
      eventType: { in: ['match_tool_start', 'match_tool_option_click', 'match_tool_result_click'] as unknown as EventType[] },
      ...periodFilter,
    },
    orderBy: { occurredAt: 'asc' },
    select: { eventType: true, sessionId: true, deviceType: true, properties: true, occurredAt: true },
  });

  const startSessions = new Set(matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_start').map((e) => e.sessionId));
  const resultClickSessions = new Set(matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_result_click').map((e) => e.sessionId));

  const sessionStepMap = new Map<string, Set<number>>();
  const stepIdMap = new Map<number, string>();
  const noiseDetected: string[] = [];

  for (const ev of matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_option_click')) {
    const props = parseProps(ev.properties);
    const stepIndex = typeof props?.stepIndex === 'number' ? props.stepIndex : -1;
    const stepId = typeof props?.stepId === 'string' ? props.stepId : 'paso';
    const optionLabel = typeof props?.optionLabel === 'string' ? props.optionLabel.trim() : '';
    if (stepIndex < 0) continue;
    if (!sessionStepMap.has(ev.sessionId)) sessionStepMap.set(ev.sessionId, new Set());
    sessionStepMap.get(ev.sessionId)!.add(stepIndex);
    if (!stepIdMap.has(stepIndex)) stepIdMap.set(stepIndex, stepId);
    if (NOISE_LABELS.has(optionLabel.toLowerCase()) && !noiseDetected.includes(optionLabel)) {
      noiseDetected.push(optionLabel);
    }
  }

  const orderedSteps = Array.from(stepIdMap.entries()).sort((a, b) => a[0] - b[0]);
  const funnelSteps = [
    { label: 'Iniciaron', count: startSessions.size },
    ...orderedSteps.map(([stepIndex, stepId]) => ({
      label: `Paso ${stepIndex + 1}: ${stepId}`,
      count: Array.from(sessionStepMap.values()).filter((s) => s.has(stepIndex)).length,
    })),
    { label: 'Eligieron resultado', count: resultClickSessions.size },
  ];

  const stepOptionsMap = new Map<number, Map<string, { label: string; count: number; isNoise: boolean }>>();
  for (const ev of matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_option_click')) {
    const props = parseProps(ev.properties);
    const stepIndex = typeof props?.stepIndex === 'number' ? props.stepIndex : -1;
    const optionLabel = typeof props?.optionLabel === 'string' ? props.optionLabel.trim() : '—';
    if (stepIndex < 0) continue;
    if (!stepOptionsMap.has(stepIndex)) stepOptionsMap.set(stepIndex, new Map());
    const opts = stepOptionsMap.get(stepIndex)!;
    if (!opts.has(optionLabel)) opts.set(optionLabel, { label: optionLabel, count: 0, isNoise: NOISE_LABELS.has(optionLabel.toLowerCase()) });
    opts.get(optionLabel)!.count++;
  }

  const stepOptionRankings = Array.from(stepOptionsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stepIndex, opts]) => ({
      stepIndex,
      stepId: stepIdMap.get(stepIndex) ?? 'paso',
      options: Array.from(opts.values()).sort((a, b) => b.count - a.count).slice(0, 6),
    }));

  const resultClicksMap = new Map<string, number>();
  for (const ev of matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_result_click')) {
    const props = parseProps(ev.properties);
    const name = typeof props?.name === 'string' ? props.name : null;
    if (!name) continue;
    resultClicksMap.set(name, (resultClicksMap.get(name) ?? 0) + 1);
  }
  const topResults = Array.from(resultClicksMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([result, count]) => ({ result, count }));

  const deviceSessionMap = new Map<string, string>();
  for (const ev of matchToolEvents) {
    if (!deviceSessionMap.has(ev.sessionId) && ev.deviceType) deviceSessionMap.set(ev.sessionId, ev.deviceType);
  }
  const dc = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  for (const d of Array.from(deviceSessionMap.values())) {
    if (d === 'desktop') dc.desktop++; else if (d === 'mobile') dc.mobile++; else if (d === 'tablet') dc.tablet++; else dc.unknown++;
  }

  const totalStarted = startSessions.size;
  const totalCompleted = resultClickSessions.size;
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;
  const totalOptionClicks = matchToolEvents.filter((e) => (e.eventType as unknown as string) === 'match_tool_option_click').length;
  const avgClicksPerSession = totalStarted > 0 ? Math.round((totalOptionClicks / totalStarted) * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Match Tool Analytics</h1>
          <p className="text-sm text-muted-foreground">Embudo por sesión, abandono y opciones por paso</p>
        </div>
        <PeriodSelector current={daysParam ? String(daysParam) : null} />
      </div>

      {noiseDetected.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Problema de instrumentación detectado</p>
              <p className="text-amber-700 mt-0.5">
                Valores que parecen etiquetas de botones de navegación, no opciones de contenido:{' '}
                {noiseDetected.map((l) => (
                  <Badge key={l} className="bg-amber-200 text-amber-900 mx-0.5 text-xs">{l}</Badge>
                ))}
              </p>
              <p className="text-amber-600 text-xs mt-1">
                Verificar que <code>match_tool_option_click</code> no se dispare al presionar
                "Continuar" u otros controles de navegación interna del wizard.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sesiones iniciadas</p>
            <p className="text-2xl font-bold">{totalStarted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Completaron (eligieron resultado)</p>
            <p className="text-2xl font-bold text-emerald-600">{totalCompleted}</p>
          </CardContent>
        </Card>
        <Card className={completionRate < 20 ? 'border-amber-300' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tasa de finalización</p>
            <p className={`text-2xl font-bold ${completionRate < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{completionRate}%</p>
            {completionRate < 20 && <p className="text-xs text-amber-600 mt-0.5">Bajo — revisar pasos de abandono</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Opciones/sesión promedio</p>
            <p className="text-2xl font-bold">{avgClicksPerSession}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embudo por sesión</CardTitle>
          <CardDescription>Sesiones únicas que alcanzaron cada paso — el porcentaje es relativo a sesiones iniciadas</CardDescription>
        </CardHeader>
        <CardContent>
          {funnelSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const prev = funnelSteps[i - 1];
                const dropout = prev ? prev.count - step.count : 0;
                const dropoutPct = prev && prev.count > 0 ? Math.round((dropout / prev.count) * 100) : null;
                const barWidth = funnelSteps[0].count > 0 ? Math.round((step.count / funnelSteps[0].count) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    {i > 0 && dropout > 0 && (
                      <p className="text-xs text-red-500 pl-2">↓ {dropout} abandonaron ({dropoutPct}%)</p>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-48 shrink-0 text-muted-foreground">{step.label}</span>
                      <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-sm font-semibold w-10 text-right tabular-nums">{step.count}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{pct(step.count, funnelSteps[0].count)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribución por dispositivo</CardTitle>
          <CardDescription>Sesiones únicas que iniciaron el Match Tool</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {([['Móvil', dc.mobile, Smartphone, 'text-indigo-600'], ['Escritorio', dc.desktop, Monitor, 'text-sky-600'], ['Tablet', dc.tablet, Monitor, 'text-purple-600'], ['Sin datos', dc.unknown, Monitor, 'text-muted-foreground']] as const).map(([label, count, Icon, color]) => (
              <div key={label as string} className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-bold">{count as number}</p>
                  <p className="text-xs text-muted-foreground">{pct(count as number, totalStarted)}</p>
                </div>
              </div>
            ))}
          </div>
          {totalStarted > 0 && dc.mobile / totalStarted > 0.7 && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              +70% móvil — priorizar experiencia móvil en el Match Tool.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Opciones por paso</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {stepOptionRankings.map(({ stepIndex, stepId, options }) => {
            const maxCount = options.filter(o => !o.isNoise)[0]?.count ?? 1;
            const hasNoise = options.some((o) => o.isNoise);
            return (
              <Card key={stepIndex} className={hasNoise ? 'border-amber-200' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Paso {stepIndex + 1}: {stepId}</CardTitle>
                    {hasNoise && <Badge className="bg-amber-100 text-amber-700 text-xs">Ruido</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className={`flex items-center gap-2 ${opt.isNoise ? 'opacity-40' : ''}`}>
                        <span className={`text-xs flex-1 truncate ${opt.isNoise ? 'line-through text-muted-foreground' : ''}`}>
                          {opt.label}{opt.isNoise && <span className="ml-1 text-amber-600 not-italic"> (ruido)</span>}
                        </span>
                        <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${maxCount > 0 ? Math.round((opt.count / maxCount) * 100) : 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right tabular-nums">{opt.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {topResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Productos más elegidos en resultados</CardTitle>
            <CardDescription>Clics en productos tras recibir una recomendación del Match Tool</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topResults.map(({ result, count }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">{result}</span>
                  <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / topResults[0].count) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
