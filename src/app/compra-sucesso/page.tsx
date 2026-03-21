"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface SessionData {
  imageId: string;
  variationIndex: number;
  imageUrl: string;
  status: string;
  cartStatus: string;
}

function CompraSucessoContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Sessão de pagamento não encontrada.");
      setLoading(false);
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch(
          `/api/checkout/session?session_id=${encodeURIComponent(sessionId!)}`
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erro ao carregar dados da compra.");
          return;
        }

        setSessionData(data);
      } catch {
        setError("Erro de conexão. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  async function handleDownload() {
    if (!sessionData?.imageUrl) return;

    try {
      const response = await fetch(sessionData.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `figuri-${sessionData.imageId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Erro ao baixar. Tente clicar com botão direito na imagem e salvar.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D0D0B",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily: "'Barlow Condensed', 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {loading && (
          <div>
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              &#9917;
            </div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "#00E05A",
              }}
            >
              Carregando sua figurinha...
            </p>
          </div>
        )}

        {error && (
          <div>
            <p
              style={{
                fontSize: 18,
                color: "#ff6b6b",
                marginBottom: 24,
              }}
            >
              {error}
            </p>
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "rgba(255,255,255,0.7)",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              &#8617; Voltar ao inicio
            </a>
          </div>
        )}

        {sessionData && (
          <div>
            <div
              style={{
                fontSize: 48,
                marginBottom: 8,
              }}
            >
              &#127881;
            </div>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "2rem",
                color: "#00E05A",
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              Compra realizada com sucesso!
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                marginBottom: 32,
              }}
            >
              Sua figurinha em alta resolucao esta pronta
            </p>

            <div
              style={{
                width: 280,
                margin: "0 auto 28px",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow:
                  "0 0 40px rgba(0, 224, 90, 0.15), 0 20px 60px rgba(0, 0, 0, 0.5)",
                border: "2px solid #F5C518",
              }}
            >
              <img
                src={sessionData.imageUrl}
                alt="Sua figurinha FIGURI IA"
                style={{
                  width: "100%",
                  display: "block",
                  aspectRatio: "3/4",
                  objectFit: "cover",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              <button
                onClick={handleDownload}
                style={{
                  display: "block",
                  width: "100%",
                  background:
                    "linear-gradient(135deg, #00A651, #007A3A)",
                  color: "#fff",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 16,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: "14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(0,166,81,0.3)",
                }}
              >
                &#11015; Baixar figurinha
              </button>

              <a
                href="/"
                style={{
                  display: "block",
                  width: "100%",
                  background: "transparent",
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  textAlign: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                &#9917; Criar outra figurinha
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompraSucessoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <CompraSucessoContent />
    </Suspense>
  );
}
