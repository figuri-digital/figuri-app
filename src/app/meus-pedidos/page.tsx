'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ytzkwhozesiomcvmkgyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0emt3aG96ZXNpb21jdm1rZ3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzA5NDgsImV4cCI6MjA4OTQ0Njk0OH0.jTlhLYMEhs3NA1t1PAExGvdIikSxz2ssL7IWjoMSWNE';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ImageRecord {
  id: string;
  style: string;
  country: string;
  player_name: string;
  status: string;
  watermark_url: string | null;
  created_at: string;
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  processing: { label: 'Processando', color: '#F5C518', bg: 'rgba(245,197,24,0.12)' },
  completed: { label: 'Concluido', color: '#00E05A', bg: 'rgba(0,224,90,0.12)' },
  failed: { label: 'Falhou', color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
};

export default function MeusPedidosPage() {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }
      setAuthenticated(true);

      const { data, error } = await sb
        .from('images')
        .select('id, style, country, player_name, status, watermark_url, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setImages(data as ImageRecord[]);
      }
      setLoading(false);
    }
    init();
  }, []);

  if (!authenticated) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0D0B',
      color: '#fff',
      fontFamily: "'Lora', Georgia, serif",
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <a href="/" style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          textDecoration: 'none',
        }}>
          &larr; Voltar
        </a>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 22,
          color: '#F5C518',
          letterSpacing: 2,
        }}>
          FIGURI <span style={{ color: '#00E05A' }}>IA</span>
        </span>
        <div style={{ width: 60 }} />
      </header>

      <main style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '32px 20px 64px',
      }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 36,
          letterSpacing: 2,
          marginBottom: 8,
        }}>
          Meus Pedidos
        </h1>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 14,
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 32,
        }}>
          Suas figurinhas geradas aparecem aqui
        </p>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 0',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)',
          }}>
            Carregando...
          </div>
        ) : images.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 20px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9917;</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 8,
            }}>
              Voce ainda nao gerou nenhuma figurinha
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 24,
            }}>
              Suba uma foto e vire jogador da Copa em 30 segundos
            </div>
            <a href="/#upload" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #00A651, #007A3A)',
              color: '#fff',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 1,
              textTransform: 'uppercase' as const,
              padding: '14px 32px',
              borderRadius: 8,
              textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(0,166,81,0.3)',
            }}>
              Criar Minha Figurinha
            </a>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {images.map((img) => {
              const st = statusLabels[img.status] || statusLabels.processing;
              return (
                <div key={img.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    aspectRatio: '3/4',
                    background: '#1A1A17',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {img.watermark_url ? (
                      <img
                        src={img.watermark_url}
                        alt={img.player_name || 'Figurinha'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 48, opacity: 0.15 }}>&#9917;</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#fff',
                      marginBottom: 4,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 0.5,
                    }}>
                      {img.player_name || 'Sem nome'}
                    </div>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 8,
                    }}>
                      {img.style || '—'} &middot; {img.country || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: 1,
                        color: st.color,
                        background: st.bg,
                        padding: '3px 10px',
                        borderRadius: 4,
                      }}>
                        {st.label}
                      </span>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.25)',
                      }}>
                        {new Date(img.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {img.status === 'completed' && (
                      <button style={{
                        marginTop: 10,
                        width: '100%',
                        background: 'linear-gradient(135deg, #00A651, #007A3A)',
                        color: '#fff',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        textTransform: 'uppercase' as const,
                        letterSpacing: 0.5,
                        padding: '10px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                      }}>
                        Comprar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
