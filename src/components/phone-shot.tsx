// An app screenshot inside an iPhone frame. The frame takes its height from the
// screenshot, and an empty status-bar strip sits above it, so the whole capture is shown
// and the Dynamic Island never covers app content.
import type { CSSProperties } from 'react';

export interface PhoneShotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Color of the screenshot's top edge, so the status bar blends into it. */
  statusColor: string;
  className?: string;
  priority?: boolean;
}

export function PhoneShot({ src, alt, width, height, statusColor, className, priority = false }: PhoneShotProps) {
  return (
    <div className={className ? `phone-shot ${className}` : 'phone-shot'}>
      <div className="phone-shot__screen" style={{ '--status-bg': statusColor } as CSSProperties}>
        <div className="phone-shot__status" aria-hidden="true" />
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
        />
      </div>
    </div>
  );
}
