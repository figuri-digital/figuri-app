import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=swap');

        .nf-root {
          min-height: 100vh;
          background-color: #EDFBD9;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: 'Montserrat', sans-serif;
          overflow: hidden;
        }

        /* ── TOPO ── */
        .nf-header {
          width: 100%;
          background-color: #1A2B01;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 32px 20px 56px;
          position: relative;
        }
        .nf-header-logo {
          position: relative;
          z-index: 2;
        }

        /* Curvas decorativas na base do header */
        .nf-header-curve-dark {
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 80px;
          overflow: hidden;
          line-height: 0;
        }
        .nf-header-curve-dark svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* ── CONTEÚDO ── */
        .nf-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 20px 60px;
          text-align: center;
          flex: 1;
        }

        .nf-oops {
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 800;
          color: #345403;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        /* ── NÚMEROS 404 ── */
        .nf-code {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 10px;
          line-height: 1;
        }
        .nf-digit {
          font-size: clamp(120px, 20vw, 220px);
          font-weight: 800;
          color: #345403;
          line-height: 0.9;
          user-select: none;
        }

        /* Bola com linhas de movimento */
        .nf-ball-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: clamp(100px, 16vw, 180px);
          height: clamp(100px, 16vw, 180px);
          flex-shrink: 0;
        }

        /* Linhas de velocidade atrás da bola */
        .nf-motion-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .nf-motion-lines::before,
        .nf-motion-lines::after {
          content: '';
          position: absolute;
          border-radius: 4px;
          background: linear-gradient(90deg, transparent 0%, #94DD2D 100%);
          transform-origin: right center;
        }
        /* Linha grande central */
        .nf-motion-lines::before {
          width: 140%;
          height: 7px;
          top: 62%;
          right: 78%;
          transform: rotate(-22deg);
          opacity: 0.85;
        }
        /* Linha pequena superior */
        .nf-motion-lines::after {
          width: 100%;
          height: 4px;
          top: 42%;
          right: 82%;
          transform: rotate(-22deg);
          opacity: 0.55;
        }

        /* Linha extra inferior — via span */
        .nf-line-extra {
          position: absolute;
          width: 80%;
          height: 3px;
          border-radius: 3px;
          background: linear-gradient(90deg, transparent, #94DD2D);
          top: 80%;
          right: 85%;
          transform: rotate(-22deg);
          transform-origin: right center;
          opacity: 0.40;
        }

        .nf-ball-img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.18));
        }

        /* ── SUBTÍTULO ── */
        .nf-subtitle {
          font-size: clamp(18px, 3vw, 35px);
          font-weight: 600;
          color: #345403;
          margin-bottom: 40px;
          letter-spacing: 0.01em;
        }

        /* ── BOTÕES ── */
        .nf-btns {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .nf-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #94DD2D;
          color: #1A2B01;
          font-family: 'Montserrat', sans-serif;
          font-size: 15px;
          font-weight: 800;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 50px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 18px rgba(148,221,45,0.30);
        }
        .nf-btn:hover {
          background: #a8f030;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(148,221,45,0.40);
        }
        .nf-btn:active { transform: translateY(0); }

        .nf-btn-wpp {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: #345403;
          font-family: 'Montserrat', sans-serif;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          padding: 10px 24px;
          border-radius: 50px;
          border: 1.5px solid rgba(52,84,3,0.25);
          letter-spacing: 0.02em;
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
        }
        .nf-btn-wpp:hover {
          border-color: #25D366;
          background: rgba(37,211,102,0.08);
          transform: translateY(-1px);
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 480px) {
          .nf-header { padding: 24px 16px 44px; }
          .nf-content { padding: 36px 16px 48px; }
          .nf-oops { margin-bottom: 4px; }
          .nf-subtitle { margin-bottom: 28px; }
        }
      `}</style>

      <div className="nf-root">

        {/* ── HEADER VERDE ESCURO ── */}
        <header className="nf-header">
          <div className="nf-header-logo">
            <Image
              src="/logo.png"
              alt="Figuri"
              width={120}
              height={48}
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* Curva decorativa na base */}
          <div className="nf-header-curve-dark">
            <svg
              viewBox="0 0 1440 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              {/* Camada escura */}
              <path d="M0 0 H1440 C1093 107 347 107 0 0Z" fill="#396100" />
              {/* Camada verde-limão mais clara */}
              <path d="M0 0 H1440 C1093 90 347 90 0 0Z" fill="#EDFBD9" opacity="0.12" />
            </svg>
          </div>
        </header>

        {/* ── CONTEÚDO ── */}
        <main className="nf-content">
          <p className="nf-oops">oops, erro</p>

          <div className="nf-code">
            <span className="nf-digit">4</span>

            {/* Bola de futebol com linhas de velocidade */}
            <div className="nf-ball-wrap">
              <div className="nf-motion-lines">
                <span className="nf-line-extra" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/404-ball.svg"
                alt="bola de futebol"
                className="nf-ball-img"
              />
            </div>

            <span className="nf-digit">4</span>
          </div>

          <p className="nf-subtitle">página não encontrada</p>

          <div className="nf-btns">
            <Link href="/" className="nf-btn">
              ⚽ Voltar para o início
            </Link>
            <a
              href="https://wa.me/5531982668673?text=Ol%C3%A1%2C%20encontrei%20um%20erro%20no%20site%20da%20Figuri%20e%20preciso%20de%20ajuda."
              target="_blank"
              rel="noopener noreferrer"
              className="nf-btn-wpp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#25D366"/>
              </svg>
              Falar com suporte no WhatsApp
            </a>
          </div>
        </main>

      </div>
    </>
  );
}
