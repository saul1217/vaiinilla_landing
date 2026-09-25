import type { ReactNode } from 'react';
import { useSheetMotion } from './use-sheet-motion';

type DragHandle = ReturnType<typeof useSheetMotion>['dragHandle'];

/** Full-screen sheet that slides in, can be dragged down to dismiss, and animates out before unmounting. */
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
    <section ref={ref} className={className} aria-labelledby={labelledBy}>
      {children(close, dragHandle)}
    </section>
  );
}
