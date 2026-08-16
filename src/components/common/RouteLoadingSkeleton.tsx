export default function RouteLoadingSkeleton() {
  return (
    <section role="status" aria-live="polite" aria-label="Loading page" className="route-skeleton-shell techpack-canvas">
      <div className="route-skeleton-frame" aria-hidden="true">
        <div className="route-skeleton-kicker" />
        <div className="route-skeleton-title" />
        <div className="route-skeleton-copy" />
        <div className="route-skeleton-grid">
          {[0, 1, 2].map(item => (
            <div key={item}>
              <div className="route-skeleton-block" />
              <div className="route-skeleton-line" />
              <div className="route-skeleton-line route-skeleton-line-short" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading page. Please wait.</span>
    </section>
  )
}
