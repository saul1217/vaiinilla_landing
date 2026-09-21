import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AlumnoLockup({
  to = '/pedir',
  onDark = false,
  linked = true,
}: {
  to?: string;
  onDark?: boolean;
  linked?: boolean;
}) {
  const className = onDark ? 'alumno-lockup alumno-lockup--on-dark' : 'alumno-lockup';
  const content = (
    <>
      <img src="/brand/vaiinilla-mark.webp" alt="" width="36" height="36" />
      <span translate="no">Vaiinilla.</span>
    </>
  );
  if (!linked) {
    return (
      <p className={className} aria-label="Vaiinilla">
        {content}
      </p>
    );
  }
  return (
    <Link className={className} to={to} aria-label="Vaiinilla">
      {content}
    </Link>
  );
}

export function AlumnoLogo({
  onDark = false,
  className,
  alt = 'Vaiinilla',
}: {
  onDark?: boolean;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={className ?? 'alumno-logo'}
      src={onDark ? '/brand/vaiinilla-logo-dark.webp' : '/brand/vaiinilla-logo-light.webp'}
      alt={alt}
      width="280"
      height="220"
    />
  );
}

export function AlumnoBack({
  onClick,
  to,
  children = 'Volver',
}: {
  onClick?: () => void;
  to?: string;
  children?: ReactNode;
}) {
  const content = (
    <>
      <BackChevron />
      {children}
    </>
  );
  if (to) {
    return (
      <Link className="alumno-back" to={to}>
        {content}
      </Link>
    );
  }
  return (
    <button className="alumno-back" type="button" onClick={onClick}>
      {content}
    </button>
  );
}

export function AlumnoPageHeader({
  kicker,
  title,
  back,
  actions,
  lead,
}: {
  kicker?: string;
  title: ReactNode;
  back?: { to?: string; onClick?: () => void; label?: string };
  actions?: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="alumno-pagehead">
      <div className="alumno-pagehead__brand">
        <AlumnoLockup />
        {actions ? <div className="alumno-top__actions">{actions}</div> : null}
      </div>
      {back ? (
        <AlumnoBack to={back.to} onClick={back.onClick}>
          {back.label ?? 'Volver'}
        </AlumnoBack>
      ) : null}
      {kicker ? <p className="alumno-kicker">{kicker}</p> : null}
      <h1>{title}</h1>
      {lead ? <p className="alumno-lead">{lead}</p> : null}
    </header>
  );
}

function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.7 4.3a1 1 0 0 1 0 1.4L9.42 12l6.3 6.3a1 1 0 1 1-1.42 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.42 0Z"
      />
    </svg>
  );
}
