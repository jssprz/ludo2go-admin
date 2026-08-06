'use client';

import { Fragment, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type GroupedQueryRow = {
  key: string;
  rawQuery: string | null;
  normalizedQuery: string | null;
  count: number;
  clicks: number;
  ctr: number;
  firstAtLabel: string;
  lastAtLabel: string;
  avgDaily: number;
  avgWeekly: number;
  distinctRawQueryCount: number;
  rawQueryVariants: Array<{
    value: string;
    count: number;
  }>;
};

type Props = {
  rows: GroupedQueryRow[];
  unknownTermLabel: string;
  emptyLabel: string;
  detailsLabel: string;
    detailsListLabel: string;
  headers: {
    rawQuery: string;
    normalizedQuery: string;
    count: string;
    clicks: string;
    ctr: string;
    firstDatetime: string;
    lastDatetime: string;
    avgDaily: string;
    avgWeekly: string;
  };
};

export function GroupedQueryTable({
  rows,
  unknownTermLabel,
  emptyLabel,
  detailsLabel,
  detailsListLabel,
  headers,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{headers.rawQuery}</TableHead>
          <TableHead>{headers.normalizedQuery}</TableHead>
          <TableHead className="text-right">{headers.count}</TableHead>
          <TableHead className="text-right">{headers.clicks}</TableHead>
          <TableHead className="text-right">{headers.ctr}</TableHead>
          <TableHead>{headers.firstDatetime}</TableHead>
          <TableHead>{headers.lastDatetime}</TableHead>
          <TableHead className="text-right">{headers.avgDaily}</TableHead>
          <TableHead className="text-right">{headers.avgWeekly}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.slice(0, 100).map((row) => {
            const isExpanded = expandedKey === row.key;

            return (
              <Fragment key={row.key}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedKey((current) => (current === row.key ? null : row.key))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setExpandedKey((current) => (current === row.key ? null : row.key));
                    }
                  }}
                >
                  <TableCell>{row.rawQuery ?? unknownTermLabel}</TableCell>
                  <TableCell>{row.normalizedQuery ?? unknownTermLabel}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{row.clicks}</TableCell>
                  <TableCell className="text-right">{row.ctr.toFixed(1)}%</TableCell>
                  <TableCell>{row.firstAtLabel}</TableCell>
                  <TableCell>{row.lastAtLabel}</TableCell>
                  <TableCell className="text-right">{row.avgDaily.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{row.avgWeekly.toFixed(2)}</TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={9} className="text-sm">
                      <p className="font-medium">
                        {detailsLabel}: {row.distinctRawQueryCount}
                      </p>
                      {row.rawQueryVariants.length > 0 && (
                        <div className="mt-2 text-muted-foreground">
                          <span>{detailsListLabel}: </span>
                          <span>
                            {row.rawQueryVariants
                              .map((variant) => `${variant.value} (${variant.count})`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
