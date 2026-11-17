import type { ReactNode } from 'react';
import { MotionSheet } from './motion-sheet';

/** Hoja de abajo de modo papás: se arrastra para cerrarla y se desplaza si su contenido es largo. */
export function ParentSheet({
  id,
  title,
  lead,
  onClosed,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  onClosed: () => void;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <MotionSheet className="alumno-sheet alumno-codesheet parent-sheet" labelledBy={id} onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel parent-sheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <h2 id={id}>{title}</h2>
          {lead ? <p className="alumno-codesheet__lead">{lead}</p> : null}
          {children(close)}
          <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
            Cerrar
          </button>
        </div>
      )}
    </MotionSheet>
  );
}
