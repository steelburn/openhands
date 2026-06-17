import { Card } from "#/ui/card";
import { cn } from "#/utils/utils";

interface SkillCardSkeletonProps {
  className?: string;
}

export function SkillCardSkeleton({ className }: SkillCardSkeletonProps) {
  return (
    <Card theme="outlined" className={cn("p-4", className)}>
      <div className="flex items-start gap-4">
        {/* Icon skeleton */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-tertiary animate-pulse" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title skeleton */}
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-tertiary animate-pulse rounded" />
                <div className="h-4 w-12 bg-tertiary animate-pulse rounded-full" />
              </div>

              {/* Source info skeleton */}
              <div className="flex items-center gap-1.5 mt-2">
                <div className="h-3 w-3 bg-tertiary animate-pulse rounded" />
                <div className="h-3 w-16 bg-tertiary animate-pulse rounded" />
                <div className="h-3 w-8 bg-tertiary animate-pulse rounded" />
              </div>

              {/* Triggers skeleton */}
              <div className="flex items-center gap-1.5 mt-3">
                <div className="h-3 w-14 bg-tertiary animate-pulse rounded" />
                <div className="h-5 w-16 bg-tertiary animate-pulse rounded" />
                <div className="h-5 w-20 bg-tertiary animate-pulse rounded" />
              </div>
            </div>

            {/* Toggle skeleton */}
            <div className="flex-shrink-0">
              <div className="w-10 h-5 bg-tertiary animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SkillListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkillCardSkeleton key={index} />
      ))}
    </div>
  );
}
