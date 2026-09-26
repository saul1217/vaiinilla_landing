// Placeholder with the shape of the content that is loading, so the page doesn't jump when data arrives.

type SkeletonShape = 'places' | 'products' | 'orders' | 'wallet' | 'rows';

const COUNT: Record<SkeletonShape, number> = { places: 4, products: 4, orders: 3, wallet: 1, rows: 2 };

export function LoadingSkeleton({ shape, label }: { shape: SkeletonShape; label: string }) {
  return (
    <div className={`alumno-skeleton alumno-skeleton--${shape}`} role="status">
      <span className="alumno-sr-only">{label}</span>
      {Array.from({ length: COUNT[shape] }, (_, i) => (
        <div key={i} className="alumno-skeleton__item" style={{ animationDelay: `${i * 90}ms` }} aria-hidden="true">
          <span className="alumno-skeleton__media" />
          <span className="alumno-skeleton__line" />
          <span className="alumno-skeleton__line alumno-skeleton__line--short" />
        </div>
      ))}
    </div>
  );
}
