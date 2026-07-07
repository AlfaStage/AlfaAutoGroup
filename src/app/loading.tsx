export default function Loading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 container mx-auto px-4 py-8 max-w-7xl">
      {/* Top Control Bar Skeleton */}
      <div className="h-20 w-full bg-muted/30 animate-pulse rounded-xl border border-border/40" />

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted/30 animate-pulse rounded-xl border border-border/40" />
        ))}
      </div>

      {/* Groups Section Skeleton */}
      <div className="space-y-4 pt-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-muted/30 animate-pulse rounded-md" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted/30 animate-pulse rounded-md" />
            <div className="h-10 w-32 bg-muted/30 animate-pulse rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-muted/30 animate-pulse rounded-xl border border-border/40" />
          ))}
        </div>
      </div>
    </div>
  )
}
