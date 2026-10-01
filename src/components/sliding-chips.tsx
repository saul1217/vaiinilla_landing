// A row of chips with ONE highlight that springs from the previous choice to the new one,
// stretching with its velocity (motion-design: "shared indicators slide"). Labels flip colour
// as the pill arrives. The row scrolls sideways when it doesn't fit.
import { useLayoutEffect, useRef } from 'react';
import { createSpring, SNAPPY } from '../lib/spring';

export interface ChipItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export function SlidingChips({
  items,
  selected,
  onSelect,
  label,
  className,
}: {
  items: ChipItem[];
  selected: string | null;
  onSelect: (key: string) => void;
  label: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const springs = useRef<{ x: ReturnType<typeof createSpring>; w: ReturnType<typeof createSpring> } | null>(null);

  useLayoutEffect(() => {
    const el = pill.current;
    const target = selected ? buttons.current.get(selected) : null;
    if (!el) return;
    if (!target) {
      el.style.opacity = '0';
      return;
    }
    const x = target.offsetLeft;
    const w = target.offsetWidth;
    if (!springs.current) {
      // First paint: sit on the choice, no travel from the corner.
      const sx = createSpring(x, SNAPPY);
      const sw = createSpring(w, SNAPPY);
      springs.current = { x: sx, w: sw };
      const draw = (_v: number, velocity: number) => {
        const stretch = Math.min(0.22, Math.abs(velocity) / 3200);
        el.style.width = `${sw.value}px`;
        el.style.transform = `translateX(${sx.value}px) scaleX(${1 + stretch}) scaleY(${1 - stretch * 0.4})`;
      };
      sx.subscribe(draw);
      sw.subscribe(draw);
      sx.jump(x);
      sw.jump(w);
    } else {
      springs.current.x.set(x);
      springs.current.w.set(w);
    }
    el.style.opacity = '1';
    // Keep the choice in view when the row scrolls.
    const row = track.current;
    if (row && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [selected, items]);

  useLayoutEffect(
    () => () => {
      springs.current?.x.stop();
      springs.current?.w.stop();
      springs.current = null;
    },
    [],
  );

  return (
    <div className={className ? `alumno-seg ${className}` : 'alumno-seg'} role="radiogroup" aria-label={label}>
      <div className="alumno-seg__track" ref={track}>
        <span className="alumno-seg__pill" ref={pill} aria-hidden="true" />
        {items.map((item) => (
          <button
            key={item.key}
            ref={(node) => {
              if (node) buttons.current.set(item.key, node);
              else buttons.current.delete(item.key);
            }}
            type="button"
            role="radio"
            aria-checked={item.key === selected}
            disabled={item.disabled}
            className={item.key === selected ? 'alumno-seg__chip is-on' : 'alumno-seg__chip'}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
