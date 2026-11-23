import { ORDER_HELP_CASES, whatsappWith } from '../lib/order-help';
import { MotionSheet } from './motion-sheet';

/** «¿Qué pasó?» de un pedido a domicilio (Expo `OrderHelpSheet`): cada caso abre el WhatsApp del negocio. */
export function OrderHelpSheet({
  folio,
  venueName,
  whatsappUrl,
  onClosed,
}: {
  folio: number;
  venueName: string | null;
  whatsappUrl: string | null;
  onClosed: () => void;
}) {
  return (
    <MotionSheet className="alumno-sheet alumno-codesheet order-help" labelledBy="order-help-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <p className="alumno-kicker">{[`Pedido #${folio}`, venueName].filter(Boolean).join(' · ')}</p>
          <h2 id="order-help-title">¿Qué pasó?</h2>
          <p className="alumno-codesheet__lead">En cada caso te decimos qué pasa con tu dinero.</p>
          <ul className="order-help__cases">
            {ORDER_HELP_CASES.map((item) =>
              whatsappUrl ? (
                <li key={item.title}>
                  <a
                    className="order-help__case"
                    href={whatsappWith(whatsappUrl, `Pedido #${folio}: ${item.title}.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <span className="alumno-muted">{item.detail}</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </a>
                </li>
              ) : (
                <li key={item.title} className="order-help__case">
                  <span>
                    <strong>{item.title}</strong>
                    <span className="alumno-muted">{item.detail}</span>
                  </span>
                </li>
              ),
            )}
          </ul>
          {!whatsappUrl ? (
            <p className="alumno-muted">
              Este negocio no dejó su WhatsApp en Vaiinilla: llámalo o escríbele por donde lo conoces. Mientras tanto tu
              pedido y tu dinero siguen igual.
            </p>
          ) : null}
          <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
            Cerrar
          </button>
        </div>
      )}
    </MotionSheet>
  );
}