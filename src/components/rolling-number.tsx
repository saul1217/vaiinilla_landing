// A formatted amount whose digits roll into place (each digit is a 0–9 column),
// with a small per-column stagger. Screen readers get the plain text.
import { useEffect, useState, type CSSProperties } from 'react';

const DIGITS = '0123456789';

export function RollingNumber({ value, className }: { value: string; className?: string }) {
  // Start every column at 0 and roll to the real digit on the next frame.
  const [shown, setShown] = useState(() => value.replace(/\d/g, '0'));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(value));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  let column = 0;
  return (
    <span className={className ? `alumno-roll ${className}` : 'alumno-roll'}>
      <span className="alumno-sr-only">{value}</span>
      {[...value].map((char, index) => {
        if (!/\d/.test(char)) {
          return (
            <span key={index} aria-hidden="true">
              {char}
            </span>
          );
        }
        const digit = Number(shown[index] ?? '0');
        const order = column++;
        return (
          <span key={index} className="alumno-roll__col" aria-hidden="true">
            <span
              className="alumno-roll__strip"
              style={{ transform: `translateY(${-digit * 10}%)`, '--order': order } as CSSProperties}
            >
              {DIGITS}
            </span>
          </span>
        );
      })}
    </span>
  );
}
