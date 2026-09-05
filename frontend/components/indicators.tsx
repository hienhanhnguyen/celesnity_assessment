'use client';

import type { BatchIndicators, FreshnessView } from '@/lib/types.ts';
import { Badge } from './ui.tsx';

export function FreshnessBadge({ freshness }: { freshness: FreshnessView }) {
  if (freshness.lastEventTime === null) {
    return <Badge tone="neutral">no events</Badge>;
  }
  const minutes = freshness.minutesSinceLastEvent;
  const label = minutes === null ? '—' : minutes < 1 ? '<1m' : `${minutes}m`;
  return freshness.stale ? (
    <Badge tone="warn">stale · {label}</Badge>
  ) : (
    <Badge tone="ok">{label} ago</Badge>
  );
}

export function IndicatorBadges({
  indicators,
  emptyText = '—',
}: {
  indicators: BatchIndicators;
  emptyText?: string | null;
}) {
  const items: { tone: 'bad' | 'warn'; label: string }[] = [];
  if (indicators.blocked) items.push({ tone: 'bad', label: 'Blocked' });
  if (indicators.stale) items.push({ tone: 'warn', label: 'Stale' });
  if (indicators.missingData) items.push({ tone: 'warn', label: 'Missing data' });
  if (indicators.quality) items.push({ tone: 'bad', label: 'Quality' });

  if (items.length === 0) {
    return emptyText ? <span className="text-xs text-slate-300">{emptyText}</span> : null;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item.label} tone={item.tone}>
          {item.label}
        </Badge>
      ))}
    </span>
  );
}
