import Image from "next/image";

export default function Header() {
  return (
    <header
      style={{
        background: "#1A2B01",
        borderBottom: "1px solid rgba(237,251,217,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 5%",
        height: "64px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <a href="/" style={{ display: "flex", alignItems: "center" }}>
        <Image src="/logo.png" alt="Figuri" width={120} height={36} style={{ objectFit: "contain" }} priority />
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <a
          href="/login"
          style={{
            background: "transparent",
            border: "1.5px solid #EDFBD9",
            color: "#EDFBD9",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.06em",
            padding: "0.45rem 1.1rem",
            borderRadius: "6px",
            cursor: "pointer",
            textDecoration: "none",
            transition: "background 0.2s",
          }}
        >
          ENTRAR
        </a>
        <a
          href="/cadastro"
          style={{
            background: "#94DD2D",
            color: "#1A2B01",
            border: "none",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: "0.85rem",
            letterSpacing: "0.06em",
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            cursor: "pointer",
            textDecoration: "none",
            whiteSpace: "nowrap",
            transition: "background 0.2s",
          }}
        >
          ✦ CRIAR FIGURINHA
        </a>
      </div>
    </header>
  );
}
