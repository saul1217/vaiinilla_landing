import type { ReactNode } from 'react';
import { useSheetMotion } from './use-sheet-motion';

type DragHandle = ReturnType<typeof useSheetMotion>['dragHandle'];

/**
 * Sheet over a dimmed backdrop: the panel slides in, can be dragged down to
 * dismiss, and animates out (backdrop fading) before the caller unmounts it.
 */
export function MotionSheet({
  className,
  labelledBy,
  onClosed,
  children,
}: {
  className: string;
  labelledBy: string;
  onClosed: () => void;
  children: (close: () => void, dragHandle: DragHandle) => ReactNode;
}) {
  const { ref, close, dragHandle } = useSheetMotion(onClosed);
  return (
    <section className={className} aria-labelledby={labelledBy} role="dialog" aria-modal="true">
      <div className="alumno-motion-backdrop" aria-hidden="true" onClick={close} />
      <div ref={ref as React.RefObject<HTMLDivElement>} className="alumno-motion-panel">
        {children(close, dragHandle)}
      </div>
    </section>
  );
}
