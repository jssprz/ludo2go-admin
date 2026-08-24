'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, BookOpen, ExternalLink, Package, Search, Tags } from 'lucide-react';

type ActionKey = 'synonym' | 'redirect' | 'product' | 'ranking';

type ActionState = {
  synonym: boolean;
  redirect: boolean;
  product: boolean;
  ranking: boolean;
  note: string;
  resolved: boolean;
};

type Term = {
  normalizedQuery: string | null;
  count: number;
  lastAt: string;
};

const ACTION_DEFS: { key: ActionKey; label: string; Icon: React.ElementType }[] = [
  { key: 'synonym',  label: 'Sinónimo',          Icon: Tags },
  { key: 'redirect', label: 'Redirección',        Icon: ExternalLink },
  { key: 'product',  label: 'Crear producto',     Icon: Package },
  { key: 'ranking',  label: 'Mejorar ranking',    Icon: Search },
];

function loadState(id: string): ActionState {
  try {
    const raw = localStorage.getItem(`zero-action-${id}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { synonym: false, redirect: false, product: false, ranking: false, note: '', resolved: false };
}

function saveState(id: string, state: ActionState) {
  localStorage.setItem(`zero-action-${id}`, JSON.stringify(state));
}

function TermRow({ term }: { term: Term }) {
  const id = term.normalizedQuery ?? '__unknown__';
  const [state, setState] = useState<ActionState>({ synonym: false, redirect: false, product: false, ranking: false, note: '', resolved: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(loadState(id));
    setLoaded(true);
  }, [id]);

  function toggle(key: ActionKey) {
    const next = { ...state, [key]: !state[key] };
    next.resolved = ACTION_DEFS.every(({ key: k }) => next[k]);
    setState(next);
    saveState(id, next);
  }

  function markResolved() {
    const next = { ...state, synonym: true, redirect: true, product: true, ranking: true, resolved: true };
    setState(next);
    saveState(id, next);
  }

  if (!loaded) return null;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${state.resolved ? 'bg-emerald-50 border-emerald-200 opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {state.resolved && <span className="text-emerald-600 text-xs font-semibold">✓</span>}
          <span className="font-mono font-medium truncate">
            {term.normalizedQuery ?? <span className="italic text-muted-foreground">desconocido</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">{term.count}×</Badge>
          {!state.resolved && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={markResolved}>
              Marcar todo
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {ACTION_DEFS.map(({ key, label, Icon }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Checkbox
              id={`${id}-${key}`}
              checked={state[key]}
              onCheckedChange={() => toggle(key)}
              aria-label={`${label} para "${term.normalizedQuery}"`}
            />
            <Label htmlFor={`${id}-${key}`} className="flex items-center gap-1 text-xs cursor-pointer text-muted-foreground">
              <Icon className="h-3 w-3" />
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ZeroResultsQueue({ terms }: { terms: Term[] }) {
  const [showResolved, setShowResolved] = useState(false);

  const totalRate = terms.length > 0
    ? ((terms.length / terms.reduce((s, t) => s + t.count, 0) * 100) || 0)
    : 0;

  if (terms.length === 0) return null;

  return (
    <Card className={terms.length > 0 ? 'border-amber-300' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">
              Cola de acción — búsquedas sin resultados
            </CardTitle>
          </div>
          <Badge className="bg-amber-100 text-amber-800 text-sm font-bold px-2">
            {terms.length} términos
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2 mt-1">
          <BookOpen className="h-3.5 w-3.5" />
          Para cada término: marca las acciones tomadas. Estado guardado en este navegador.
          Acciones sugeridas: agregar sinónimo en el buscador · crear redirección · evaluar crear producto · ajustar ranking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {terms.map((term) => (
          <TermRow key={term.normalizedQuery ?? '__unknown__'} term={term} />
        ))}
        <p className="text-xs text-muted-foreground pt-1">
          * Estado persistido en localStorage. Para persistencia multi-usuario se requiere schema adicional.
        </p>
      </CardContent>
    </Card>
  );
}
