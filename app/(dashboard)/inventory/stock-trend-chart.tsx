import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type StockTrendPoint = {
  label: string;
  totalStock: number;
  netMovement: number;
  received: number;
  sold: number;
};

type Props = {
  points: StockTrendPoint[];
};

export function StockTrendChart({ points }: Props) {
  if (points.length === 0) {
    return null;
  }

  const width = 760;
  const height = 220;
  const padding = 24;

  const totals = points.map((point) => point.totalStock);
  const minValue = Math.min(...totals);
  const maxValue = Math.max(...totals);
  const range = Math.max(1, maxValue - minValue);

  const xForIndex = (index: number) => {
    if (points.length === 1) {
      return width / 2;
    }

    return padding + (index * (width - padding * 2)) / (points.length - 1);
  };

  const yForValue = (value: number) => {
    const normalized = (value - minValue) / range;
    return height - padding - normalized * (height - padding * 2);
  };

  const linePoints = points
    .map((point, index) => `${xForIndex(index)},${yForValue(point.totalStock)}`)
    .join(' ');

  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest.totalStock - first.totalStock;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Stock Trend by Week</CardTitle>
        <CardDescription>
          Estimated weekly stock trend built from receipts minus sold quantities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Current Estimated Stock</p>
            <p className="text-xl font-semibold">{latest.totalStock.toLocaleString()}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Change in Period</p>
            <p className={`text-xl font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {change >= 0 ? '+' : ''}{change.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Latest Week Net</p>
            <p className={`text-xl font-semibold ${latest.netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {latest.netMovement >= 0 ? '+' : ''}{latest.netMovement.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[680px] w-full"
            role="img"
            aria-label="Weekly total stock trend"
          >
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity="0.2" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity="0.2" />

            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-primary"
              points={linePoints}
            />

            {points.map((point, index) => {
              const x = xForIndex(index);
              const y = yForValue(point.totalStock);
              return (
                <g key={point.label}>
                  <circle cx={x} cy={y} r="4" className="fill-primary" />
                  <title>{`${point.label}: ${point.totalStock} total, net ${point.netMovement}`}</title>
                </g>
              );
            })}

            {points.map((point, index) => (
              <text
                key={`${point.label}-x`}
                x={xForIndex(index)}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {point.label}
              </text>
            ))}
          </svg>
        </div>

        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Week</th>
                <th className="px-3 py-2 text-right font-medium">Received</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 text-right font-medium">Estimated Total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={`${point.label}-row`} className="border-t">
                  <td className="px-3 py-2">{point.label}</td>
                  <td className="px-3 py-2 text-right">{point.received.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{point.sold.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-medium ${point.netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {point.netMovement >= 0 ? '+' : ''}{point.netMovement.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{point.totalStock.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
