export function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-card border rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-4">
        <SkeletonPulse className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-6 w-48" />
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="bg-muted p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-3 border-t flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonPulse key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <SkeletonPulse className="h-4 w-32" />
      <SkeletonCard />
      <div className="flex gap-2">
        <SkeletonPulse className="h-9 w-28" />
        <SkeletonPulse className="h-9 w-20" />
      </div>
      <SkeletonTable rows={3} cols={4} />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-lg p-5 space-y-2">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-8 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <SkeletonPulse className="h-5 w-40" />
          <SkeletonPulse className="h-48 w-full" />
        </div>
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <SkeletonPulse className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
