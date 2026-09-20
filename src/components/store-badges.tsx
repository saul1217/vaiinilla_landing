import { storeHref } from '../lib/store-links';

type StoreKind = 'apple' | 'play';

const COPY: Record<StoreKind, { kicker: string; name: string; label: string }> = {
  apple: { kicker: 'Consíguela en', name: 'App Store', label: 'App Store' },
  play: { kicker: 'Disponible en', name: 'Google Play', label: 'Google Play' },
};

function AppleMark() {
  return (
    <svg viewBox="0 0 16 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.2 10.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-1-3-1c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.3-.9-2.3-3.7Zm-2.1-6.2c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.3Z"
      />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 18 20" aria-hidden="true">
      <path fill="currentColor" d="M1 1.6v16.8c0 .7.8 1.1 1.4.7L16.2 10.7c.6-.4.6-1.3 0-1.7L2.4.9C1.8.5 1 1 1 1.6Z" />
    </svg>
  );
}

function StoreBadge({ kind, compact }: { kind: StoreKind; compact?: boolean }) {
  const href = storeHref(kind);
  const copy = COPY[kind];
  const soon = !href;
  const className = ['store-badge', compact ? 'is-compact' : '', soon ? 'is-soon' : '']
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      <span className="store-badge__mark">{kind === 'apple' ? <AppleMark /> : <PlayMark />}</span>
      <span className="store-badge__text">
        <small>{soon ? 'Próximamente' : copy.kicker}</small>
        <strong>{copy.name}</strong>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-store={kind}
      >
        {inner}
      </a>
    );
  }

  return (
    <span className={className} data-store={kind} aria-disabled="true">
      {inner}
      <span className="sr-only">
        {copy.label}, próximamente. El enlace oficial se publica cuando la tienda acepte la app.
      </span>
    </span>
  );
}

export function StoreBadges({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={['store-badges', compact ? 'is-compact' : '', className].filter(Boolean).join(' ')}>
      <StoreBadge kind="apple" compact={compact} />
      <StoreBadge kind="play" compact={compact} />
    </div>
  );
}
