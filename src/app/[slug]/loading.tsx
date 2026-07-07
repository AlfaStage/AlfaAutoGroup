export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-in fade-in duration-500">
      {/* Header Profile Skeleton */}
      <div className="h-20 border-b border-border/40 bg-card/30 flex items-center px-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/30 animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted/30 animate-pulse" />
              <div className="space-y-2 hidden sm:block">
                <div className="h-5 w-32 bg-muted/30 animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted/30 animate-pulse rounded" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
             <div className="h-9 w-12 sm:w-20 bg-muted/30 animate-pulse rounded-md" />
             <div className="h-9 w-12 sm:w-20 bg-muted/30 animate-pulse rounded-md" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs Skeleton */}
        <div className="h-10 w-full lg:w-[400px] bg-muted/30 animate-pulse rounded-md mb-6" />

        {/* Content Skeleton */}
        <div className="h-[60vh] w-full bg-muted/30 animate-pulse rounded-xl border border-border/40" />
      </div>
    </div>
  )
}
