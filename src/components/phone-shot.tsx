// An app screenshot inside an iPhone frame. The frame takes its height from the
// screenshot, and a status bar sits above it, so the whole capture is shown and the
// Dynamic Island never covers app content.
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
        <div className="phone-shot__status" aria-hidden="true">
          <span>9:41</span>
          <span className="phone-shot__icons">
            <svg viewBox="0 0 18 12"><path fill="currentColor" d="M1 9h2.5v3H1zm4.5-2H8v5H5.5zM10 4.5h2.5V12H10zM14.5 2H17v10h-2.5z" /></svg>
            <svg viewBox="0 0 16 12"><path fill="currentColor" d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .3 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2Zm0 3.7c1.4 0 2.7.5 3.6 1.4l1.3-1.3A7 7 0 0 0 8 4a7 7 0 0 0-4.9 2l1.3 1.3c1-.9 2.2-1.4 3.6-1.4Zm0 3.6c.5 0 1 .2 1.3.5L8 11.7 6.7 10c.3-.3.8-.5 1.3-.5Z" /></svg>
            <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" /><path fill="currentColor" opacity=".4" d="M24 4v4c.8-.3 1.4-1.1 1.4-2S24.8 4.3 24 4Z" /></svg>
          </span>
        </div>
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
