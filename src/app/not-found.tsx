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

        /* ── BOTÃO ── */
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

          <Link href="/" className="nf-btn">
            ⚽ Voltar para o início
          </Link>
        </main>

      </div>
    </>
  );
}
