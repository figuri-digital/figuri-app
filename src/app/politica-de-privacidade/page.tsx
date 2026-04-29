import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Figuri',
  description: 'Saiba como a Figuri coleta, utiliza e protege seus dados pessoais conforme a LGPD.',
};

export default function PoliticaDePrivacidade() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

        .pp-root {
          min-height: 100vh;
          background-color: #EDFBD9;
          font-family: 'Montserrat', sans-serif;
          color: #1A2B01;
        }

        /* ── HEADER ── */
        .pp-header {
          width: 100%;
          background-color: #1A2B01;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 28px 20px 52px;
          position: relative;
        }
        .pp-header-curve {
          position: absolute;
          bottom: -1px; left: 0;
          width: 100%; height: 60px;
          overflow: hidden; line-height: 0;
        }
        .pp-header-curve svg { display: block; width: 100%; height: 100%; }

        /* ── CONTAINER ── */
        .pp-container {
          max-width: 780px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        .pp-badge {
          display: inline-block;
          background: #94DD2D;
          color: #1A2B01;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 50px;
          margin-bottom: 16px;
        }

        .pp-title {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 800;
          color: #1A2B01;
          line-height: 1.15;
          margin-bottom: 8px;
        }

        .pp-updated {
          font-size: 13px;
          color: #5a7a1a;
          margin-bottom: 40px;
          font-weight: 500;
        }

        .pp-intro {
          background: #fff;
          border-left: 4px solid #94DD2D;
          border-radius: 0 12px 12px 0;
          padding: 20px 24px;
          font-size: 15px;
          line-height: 1.7;
          color: #2e4a05;
          margin-bottom: 40px;
        }

        /* ── SEÇÕES ── */
        .pp-section {
          margin-bottom: 36px;
        }

        .pp-section-title {
          font-size: 18px;
          font-weight: 800;
          color: #1A2B01;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pp-section-title::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 20px;
          background: #94DD2D;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .pp-section p {
          font-size: 14.5px;
          line-height: 1.75;
          color: #345403;
          margin-bottom: 12px;
        }

        .pp-section ul {
          padding-left: 20px;
          margin-bottom: 12px;
        }
        .pp-section ul li {
          font-size: 14.5px;
          line-height: 1.75;
          color: #345403;
          margin-bottom: 6px;
        }

        .pp-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          font-size: 13.5px;
        }
        .pp-table th {
          background: #1A2B01;
          color: #EDFBD9;
          font-weight: 700;
          padding: 10px 14px;
          text-align: left;
        }
        .pp-table td {
          padding: 10px 14px;
          border-bottom: 1px solid #c8e8a0;
          color: #345403;
          vertical-align: top;
        }
        .pp-table tr:nth-child(even) td { background: #f4fde8; }

        .pp-highlight {
          background: #fff8e1;
          border: 1px solid #FFC300;
          border-radius: 10px;
          padding: 16px 20px;
          font-size: 14px;
          color: #5a3e00;
          margin-bottom: 16px;
          line-height: 1.7;
        }

        .pp-rights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .pp-right-card {
          background: #fff;
          border: 1px solid #c8e8a0;
          border-radius: 10px;
          padding: 14px 16px;
        }
        .pp-right-card strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
          color: #1A2B01;
          margin-bottom: 4px;
        }
        .pp-right-card span {
          font-size: 12.5px;
          color: #5a7a1a;
          line-height: 1.5;
        }

        /* ── CONTATO ── */
        .pp-contact {
          background: #1A2B01;
          border-radius: 16px;
          padding: 28px 28px;
          color: #EDFBD9;
          margin-top: 40px;
        }
        .pp-contact h3 {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #94DD2D;
        }
        .pp-contact p {
          font-size: 14px;
          line-height: 1.7;
          margin-bottom: 8px;
          color: #c8e8a0;
        }
        .pp-contact a {
          color: #94DD2D;
          text-decoration: none;
          font-weight: 600;
        }
        .pp-contact a:hover { text-decoration: underline; }

        /* ── FOOTER LINKS ── */
        .pp-footer {
          text-align: center;
          padding: 32px 20px;
          border-top: 1px solid #c8e8a0;
          margin-top: 48px;
        }
        .pp-footer a {
          color: #5a7a1a;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          margin: 0 12px;
        }
        .pp-footer a:hover { color: #1A2B01; }

        @media (max-width: 540px) {
          .pp-container { padding: 32px 16px 60px; }
          .pp-rights-grid { grid-template-columns: 1fr; }
          .pp-table { font-size: 12px; }
          .pp-table th, .pp-table td { padding: 8px 10px; }
        }
      `}</style>

      <div className="pp-root">

        {/* HEADER */}
        <header className="pp-header">
          <Link href="/">
            <Image src="/logo.png" alt="Figuri" width={110} height={44} style={{ objectFit: 'contain' }} priority />
          </Link>
          <div className="pp-header-curve">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 0 H1440 C1093 80 347 80 0 0Z" fill="#EDFBD9" />
            </svg>
          </div>
        </header>

        {/* CONTEÚDO */}
        <main className="pp-container">
          <span className="pp-badge">Legal</span>
          <h1 className="pp-title">Política de Privacidade</h1>
          <p className="pp-updated">Última atualização: 29 de abril de 2026</p>

          <div className="pp-intro">
            A <strong>Figuri</strong> respeita a sua privacidade e está comprometida com a proteção dos seus dados pessoais,
            em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
            Esta política explica de forma clara quais dados coletamos, por que coletamos e como você pode exercer seus direitos.
          </div>

          {/* 1 */}
          <section className="pp-section">
            <h2 className="pp-section-title">1. Quem somos</h2>
            <p>
              A Figuri é uma plataforma digital que utiliza Inteligência Artificial para transformar fotografias em figurinhas
              personalizadas da Copa do Mundo 2026. Operamos sob o domínio <strong>figuri.com.br</strong> e somos responsáveis
              pelo tratamento dos seus dados pessoais.
            </p>
            <p>
              <strong>Contato do responsável pelo tratamento de dados (DPO):</strong>{' '}
              <a href="mailto:privacidade@figuri.com.br" style={{ color: '#396100', fontWeight: 600 }}>privacidade@figuri.com.br</a>
            </p>
          </section>

          {/* 2 */}
          <section className="pp-section">
            <h2 className="pp-section-title">2. Dados que coletamos</h2>
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Dado</th>
                  <th>Finalidade</th>
                  <th>Base legal (LGPD)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Nome e sobrenome</td><td>Identificação da conta e personalização da figurinha</td><td>Execução de contrato</td></tr>
                <tr><td>Endereço de e-mail</td><td>Criação de conta, envio de pedido e comunicações</td><td>Execução de contrato</td></tr>
                <tr><td>Fotografia enviada</td><td>Geração da figurinha por IA</td><td>Execução de contrato + Consentimento</td></tr>
                <tr><td>Nome para figurinha, data de nascimento e altura</td><td>Personalização do card</td><td>Execução de contrato</td></tr>
                <tr><td>Endereço de entrega</td><td>Envio do produto físico (quando aplicável)</td><td>Execução de contrato</td></tr>
                <tr><td>Dados de pagamento</td><td>Processamento da compra (via gateway seguro)</td><td>Execução de contrato</td></tr>
                <tr><td>Dados de navegação (IP, cookies)</td><td>Segurança, análise e melhoria da plataforma</td><td>Legítimo interesse</td></tr>
              </tbody>
            </table>
            <div className="pp-highlight">
              ⚠️ <strong>Fotografias:</strong> as imagens enviadas são utilizadas exclusivamente para gerar sua figurinha através de
              serviços de IA e <strong>não são usadas para treinar modelos</strong>, compartilhadas com terceiros para fins
              comerciais ou armazenadas por período superior ao necessário.
            </div>
          </section>

          {/* 3 */}
          <section className="pp-section">
            <h2 className="pp-section-title">3. Como usamos seus dados</h2>
            <ul>
              <li>Criar e gerenciar sua conta na plataforma</li>
              <li>Gerar a figurinha personalizada utilizando serviços de IA</li>
              <li>Processar pagamentos e emitir comprovantes</li>
              <li>Entregar o produto físico no endereço informado</li>
              <li>Enviar atualizações sobre seu pedido por e-mail</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
            <p>
              Não vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing.
            </p>
          </section>

          {/* 4 */}
          <section className="pp-section">
            <h2 className="pp-section-title">4. Compartilhamento de dados</h2>
            <p>Seus dados podem ser compartilhados apenas com:</p>
            <ul>
              <li><strong>Serviços de IA (geração de imagens):</strong> a fotografia é enviada a APIs de terceiros exclusivamente para gerar o resultado visual da figurinha</li>
              <li><strong>Gateway de pagamento:</strong> dados financeiros são processados por parceiros certificados PCI-DSS; não armazenamos dados de cartão</li>
              <li><strong>Serviço de armazenamento em nuvem (Supabase):</strong> para guardar imagens geradas e informações de conta</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
            <p>
              Todos os fornecedores terceiros são contratualmente obrigados a proteger seus dados e utilizá-los apenas para a
              finalidade específica contratada.
            </p>
          </section>

          {/* 5 */}
          <section className="pp-section">
            <h2 className="pp-section-title">5. Retenção de dados</h2>
            <table className="pp-table">
              <thead>
                <tr><th>Tipo de dado</th><th>Período de retenção</th></tr>
              </thead>
              <tbody>
                <tr><td>Fotografias enviadas</td><td>24 horas após a geração (excluídas automaticamente)</td></tr>
                <tr><td>Imagens geradas (figurinhas)</td><td>30 dias após a geração ou até o download</td></tr>
                <tr><td>Dados da conta</td><td>Enquanto a conta estiver ativa + 5 anos (obrigação fiscal)</td></tr>
                <tr><td>Dados de pagamento</td><td>5 anos (obrigação legal — Código Tributário Nacional)</td></tr>
                <tr><td>Logs de acesso</td><td>6 meses (Marco Civil da Internet)</td></tr>
              </tbody>
            </table>
          </section>

          {/* 6 */}
          <section className="pp-section">
            <h2 className="pp-section-title">6. Cookies e tecnologias de rastreamento</h2>
            <p>Utilizamos cookies para:</p>
            <ul>
              <li><strong>Cookies essenciais:</strong> manter sua sessão ativa e autenticar o acesso</li>
              <li><strong>Cookies de desempenho:</strong> entender como os usuários navegam no site e melhorar a experiência</li>
              <li><strong>Armazenamento local (localStorage/sessionStorage):</strong> salvar temporariamente o progresso da geração de figurinha</li>
            </ul>
            <p>
              Não utilizamos cookies de rastreamento de terceiros para fins publicitários sem seu consentimento explícito.
              Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar o funcionamento do site.
            </p>
          </section>

          {/* 7 */}
          <section className="pp-section">
            <h2 className="pp-section-title">7. Seus direitos (LGPD)</h2>
            <p>Como titular dos dados, você tem os seguintes direitos garantidos pela LGPD:</p>
            <div className="pp-rights-grid">
              <div className="pp-right-card">
                <strong>✅ Confirmação e acesso</strong>
                <span>Saber se tratamos seus dados e obter uma cópia</span>
              </div>
              <div className="pp-right-card">
                <strong>✏️ Correção</strong>
                <span>Atualizar dados incompletos, inexatos ou desatualizados</span>
              </div>
              <div className="pp-right-card">
                <strong>🗑️ Eliminação</strong>
                <span>Solicitar a exclusão de dados tratados com base em consentimento</span>
              </div>
              <div className="pp-right-card">
                <strong>📦 Portabilidade</strong>
                <span>Receber seus dados em formato estruturado e legível</span>
              </div>
              <div className="pp-right-card">
                <strong>🚫 Oposição</strong>
                <span>Opor-se ao tratamento realizado com base em legítimo interesse</span>
              </div>
              <div className="pp-right-card">
                <strong>🔕 Revogação</strong>
                <span>Retirar o consentimento a qualquer momento</span>
              </div>
            </div>
            <p>
              Para exercer qualquer direito, entre em contato por{' '}
              <a href="mailto:privacidade@figuri.com.br" style={{ color: '#396100', fontWeight: 600 }}>privacidade@figuri.com.br</a>{' '}
              ou pelo WhatsApp. Responderemos em até <strong>15 dias úteis</strong>.
            </p>
          </section>

          {/* 8 */}
          <section className="pp-section">
            <h2 className="pp-section-title">8. Segurança dos dados</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado,
              perda, destruição ou divulgação indevida, incluindo:
            </p>
            <ul>
              <li>Comunicação via HTTPS/TLS em todas as trocas de dados</li>
              <li>Autenticação segura com tokens JWT e gerenciamento de sessão</li>
              <li>Acesso restrito aos dados por parte dos colaboradores (princípio do menor privilégio)</li>
              <li>Armazenamento em infraestrutura de nuvem com certificações de segurança (Supabase / Vercel)</li>
              <li>Exclusão automática de fotografias após o prazo estabelecido</li>
            </ul>
            <p>
              Em caso de incidente de segurança que possa afetar seus dados, notificaremos você e a Autoridade Nacional de
              Proteção de Dados (ANPD) dentro dos prazos legais.
            </p>
          </section>

          {/* 9 */}
          <section className="pp-section">
            <h2 className="pp-section-title">9. Transferência internacional de dados</h2>
            <p>
              Para gerar as figurinhas, utilizamos APIs de Inteligência Artificial cujos servidores podem estar localizados
              fora do Brasil. Essas transferências são realizadas com garantias adequadas de proteção, conforme exigido
              pelo art. 33 da LGPD, e limitadas estritamente ao processamento necessário para o serviço contratado.
            </p>
          </section>

          {/* 10 */}
          <section className="pp-section">
            <h2 className="pp-section-title">10. Menores de idade</h2>
            <p>
              Nossos serviços são destinados a pessoas com <strong>18 anos ou mais</strong>. Não coletamos intencionalmente
              dados de menores de 13 anos. Se você é responsável legal por um menor e identificar que seus dados foram coletados,
              entre em contato imediatamente para que possamos excluí-los.
            </p>
          </section>

          {/* 11 */}
          <section className="pp-section">
            <h2 className="pp-section-title">11. Alterações nesta política</h2>
            <p>
              Esta política pode ser atualizada periodicamente para refletir mudanças em nossas práticas ou na legislação.
              Quando houver alterações relevantes, notificaremos por e-mail ou por aviso em destaque no site.
              A data da última atualização está sempre indicada no topo desta página.
            </p>
          </section>

          {/* CONTATO */}
          <div className="pp-contact">
            <h3>📬 Entre em contato</h3>
            <p>
              Dúvidas sobre privacidade? Quer exercer algum dos seus direitos?
              Nossa equipe está pronta para ajudar.
            </p>
            <p>
              E-mail:{' '}
              <a href="mailto:privacidade@figuri.com.br">privacidade@figuri.com.br</a>
            </p>
            <p>
              WhatsApp:{' '}
              <a href="https://wa.me/5531982668673" target="_blank" rel="noopener noreferrer">
                (31) 98266-8673
              </a>
            </p>
            <p>
              Autoridade Nacional de Proteção de Dados (ANPD):{' '}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>
            </p>
          </div>

        </main>

        {/* FOOTER */}
        <footer className="pp-footer">
          <Link href="/" className="pp-footer-link" style={{ color: '#5a7a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none', margin: '0 12px' }}>
            ⚽ Início
          </Link>
          <Link href="/termos-e-condicoes" style={{ color: '#5a7a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none', margin: '0 12px' }}>
            Termos e Condições
          </Link>
          <span style={{ color: '#8aaa3e', fontSize: 12, display: 'block', marginTop: 16 }}>
            © {new Date().getFullYear()} Figuri · Todos os direitos reservados
          </span>
        </footer>

      </div>
    </>
  );
}
