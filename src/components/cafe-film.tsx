// The café's side of an order as a silent looping film. It only downloads and plays
// while on screen, so it costs nothing to visitors who never scroll to it; with reduced
// motion it waits for the visitor to press play.
import { useEffect, useRef } from 'react';

export function CafeFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.controls = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          video.preload = 'auto';
          video.play().catch(() => {
            video.controls = true;
          });
        } else {
          video.pause();
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="cafe-film">
      <video
        ref={videoRef}
        className="cafe-film__video"
        src="/film/vaini-latte-720.mp4"
        poster="/film/vaini-latte-poster.jpg"
        width={1280}
        height={720}
        muted
        loop
        playsInline
        preload="none"
        aria-label="Vaini recibe el pedido de un latte en su panel y lo prepara"
      />
      <figcaption className="cafe-film__tag">
        <span aria-hidden="true" />
        Vista del café
      </figcaption>
    </figure>
  );
}
