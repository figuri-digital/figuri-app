import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Termos e Condições — Figuri',
  description: 'Leia os termos de uso da plataforma Figuri antes de utilizar nossos serviços.',
};

export default function TermosECondicoes() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

        .tc-root {
          min-height: 100vh;
          background-color: #EDFBD9;
          font-family: 'Montserrat', sans-serif;
          color: #1A2B01;
        }

        /* ── HEADER ── */
        .tc-header {
          width: 100%;
          background-color: #1A2B01;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 28px 20px 52px;
          position: relative;
        }
        .tc-header-curve {
          position: absolute;
          bottom: -1px; left: 0;
          width: 100%; height: 60px;
          overflow: hidden; line-height: 0;
        }
        .tc-header-curve svg { display: block; width: 100%; height: 100%; }

        /* ── CONTAINER ── */
        .tc-container {
          max-width: 780px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        .tc-badge {
          display: inline-block;
          background: #FFC300;
          color: #1A2B01;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 50px;
          margin-bottom: 16px;
        }

        .tc-title {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 800;
          color: #1A2B01;
          line-height: 1.15;
          margin-bottom: 8px;
        }

        .tc-updated {
          font-size: 13px;
          color: #5a7a1a;
          margin-bottom: 40px;
          font-weight: 500;
        }

        .tc-intro {
          background: #fff;
          border-left: 4px solid #FFC300;
          border-radius: 0 12px 12px 0;
          padding: 20px 24px;
          font-size: 15px;
          line-height: 1.7;
          color: #2e4a05;
          margin-bottom: 40px;
        }

        /* ── SEÇÕES ── */
        .tc-section {
          margin-bottom: 36px;
        }

        .tc-section-title {
          font-size: 18px;
          font-weight: 800;
          color: #1A2B01;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tc-section-title::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 20px;
          background: #FFC300;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .tc-section p {
          font-size: 14.5px;
          line-height: 1.75;
          color: #345403;
          margin-bottom: 12px;
        }

        .tc-section ul {
          padding-left: 20px;
          margin-bottom: 12px;
        }
        .tc-section ul li {
          font-size: 14.5px;
          line-height: 1.75;
          color: #345403;
          margin-bottom: 6px;
        }

        .tc-highlight {
          background: #fff8e1;
          border: 1px solid #FFC300;
          border-radius: 10px;
          padding: 16px 20px;
          font-size: 14px;
          color: #5a3e00;
          margin-bottom: 16px;
          line-height: 1.7;
        }

        .tc-warning {
          background: #fff0f0;
          border: 1px solid #ffb3b3;
          border-radius: 10px;
          padding: 16px 20px;
          font-size: 14px;
          color: #7a1a1a;
          margin-bottom: 16px;
          line-height: 1.7;
        }

        .tc-products {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .tc-product-card {
          background: #fff;
          border: 1px solid #c8e8a0;
          border-radius: 10px;
          padding: 14px 16px;
        }
        .tc-product-card strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
          color: #1A2B01;
          margin-bottom: 4px;
        }
        .tc-product-card span {
          font-size: 12.5px;
          color: #5a7a1a;
          line-height: 1.5;
        }
        .tc-product-price {
          display: block;
          font-size: 15px;
          font-weight: 800;
          color: #396100;
          margin-top: 6px;
        }

        /* ── CONTATO ── */
        .tc-contact {
          background: #1A2B01;
          border-radius: 16px;
          padding: 28px 28px;
          color: #EDFBD9;
          margin-top: 40px;
        }
        .tc-contact h3 {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #FFC300;
        }
        .tc-contact p {
          font-size: 14px;
          line-height: 1.7;
          margin-bottom: 8px;
          color: #c8e8a0;
        }
        .tc-contact a {
          color: #94DD2D;
          text-decoration: none;
          font-weight: 600;
        }
        .tc-contact a:hover { text-decoration: underline; }

        /* ── FOOTER ── */
        .tc-footer {
          text-align: center;
          padding: 32px 20px;
          border-top: 1px solid #c8e8a0;
          margin-top: 48px;
        }

        @media (max-width: 540px) {
          .tc-container { padding: 32px 16px 60px; }
          .tc-products { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="tc-root">

        {/* HEADER */}
        <header className="tc-header">
          <Link href="/">
            <Image src="/logo.png" alt="Figuri" width={110} height={44} style={{ objectFit: 'contain' }} priority />
          </Link>
          <div className="tc-header-curve">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 0 H1440 C1093 80 347 80 0 0Z" fill="#EDFBD9" />
            </svg>
          </div>
        </header>

        {/* CONTEÚDO */}
        <main className="tc-container">
          <span className="tc-badge">Legal</span>
          <h1 className="tc-title">Termos e Condições</h1>
          <p className="tc-updated">Última atualização: 29 de abril de 2026</p>

          <div className="tc-intro">
            Ao criar uma conta ou utilizar qualquer serviço da <strong>Figuri</strong>, você declara ter lido, entendido e
            concordado com estes Termos e Condições. Se não concordar com algum ponto, solicitamos que não utilize
            a plataforma. Dúvidas? Fale conosco antes de prosseguir.
          </div>

          {/* 1 */}
          <section className="tc-section">
            <h2 className="tc-section-title">1. Sobre a Figuri</h2>
            <p>
              A Figuri é uma plataforma digital que oferece o serviço de criação de figurinhas personalizadas da Copa do
              Mundo 2026, utilizando tecnologia de Inteligência Artificial para inserir a imagem do usuário em modelos
              de figurinha oficiais. Operamos sob o domínio <strong>figuri.com.br</strong>.
            </p>
            <p>
              O serviço é oferecido como entretenimento e uso pessoal. A Figuri não possui vínculo oficial com a FIFA,
              CBF ou qualquer federação de futebol, exceto quando expressamente indicado.
            </p>
          </section>

          {/* 2 */}
          <section className="tc-section">
            <h2 className="tc-section-title">2. Elegibilidade e cadastro</h2>
            <ul>
              <li>Para criar uma conta, você deve ter <strong>18 anos ou mais</strong> (ou 16 anos com autorização dos responsáveis)</li>
              <li>Você se compromete a fornecer informações verdadeiras, precisas e atualizadas no cadastro</li>
              <li>É proibido criar contas falsas, múltiplas contas para burlar limites ou se passar por outra pessoa</li>
              <li>Você é responsável pela segurança da sua senha e por todas as atividades realizadas na sua conta</li>
              <li>Notifique-nos imediatamente em caso de uso não autorizado da sua conta</li>
            </ul>
          </section>

          {/* 3 */}
          <section className="tc-section">
            <h2 className="tc-section-title">3. Serviços e produtos</h2>
            <p>A Figuri oferece os seguintes produtos:</p>
            <div className="tc-products">
              <div className="tc-product-card">
                <strong>📱 Figurinha Digital</strong>
                <span>Arquivo digital da sua figurinha para download e compartilhamento</span>
                <em className="tc-product-price">R$ 19,90</em>
              </div>
              <div className="tc-product-card">
                <strong>📦 Figurinha Física</strong>
                <span>Impressão profissional enviada pelos Correios ao seu endereço</span>
                <em className="tc-product-price">R$ 24,90</em>
              </div>
              <div className="tc-product-card">
                <strong>🖼 Com Moldura Premium</strong>
                <span>Figurinha digital com moldura exclusiva da Copa 2026</span>
                <em className="tc-product-price">R$ 49,90</em>
              </div>
              <div className="tc-product-card">
                <strong>📚 Pack de Figurinhas</strong>
                <span>Conjunto com múltiplas versões digitais da sua figurinha</span>
                <em className="tc-product-price">R$ 69,90</em>
              </div>
            </div>
            <p>
              O serviço de <strong>preview gratuito</strong> permite gerar até 5 prévias sem custo, para você avaliar o
              resultado antes de comprar. O preview gratuito não inclui download em alta resolução.
            </p>
          </section>

          {/* 4 */}
          <section className="tc-section">
            <h2 className="tc-section-title">4. Uso de fotografias e Inteligência Artificial</h2>
            <div className="tc-highlight">
              ℹ️ Ao enviar uma fotografia, você declara que é o titular dos direitos sobre a imagem ou que possui
              autorização expressa da(s) pessoa(s) retratada(s) para este uso.
            </div>
            <p>
              A imagem enviada é processada por serviços de Inteligência Artificial para gerar a figurinha personalizada.
              Ao utilizar o serviço, você:
            </p>
            <ul>
              <li>Concede à Figuri licença temporária e limitada para processar a imagem com a finalidade exclusiva de gerar a figurinha</li>
              <li>Confirma que a fotografia não contém conteúdo ilegal, ofensivo ou que viole direitos de terceiros</li>
              <li>Entende que os resultados gerados por IA podem variar e que a qualidade depende da foto enviada</li>
              <li>Aceita que a Figuri não garante que o resultado será idêntico à foto original</li>
            </ul>
            <p>
              A fotografia original é excluída automaticamente dos nossos servidores em até <strong>24 horas</strong> após
              a geração da figurinha.
            </p>
          </section>

          {/* 5 */}
          <section className="tc-section">
            <h2 className="tc-section-title">5. Conteúdo proibido</h2>
            <p>É estritamente proibido enviar imagens ou utilizar a plataforma para:</p>
            <ul>
              <li>Fotografias de menores de 18 anos sem autorização expressa dos responsáveis legais</li>
              <li>Conteúdo sexual explícito ou de nudez</li>
              <li>Imagens que incitem ódio, discriminação, racismo ou violência</li>
              <li>Fotos de terceiros sem o consentimento dessas pessoas</li>
              <li>Imagens protegidas por direitos autorais de terceiros</li>
              <li>Qualquer uso que viole a legislação brasileira em vigor</li>
            </ul>
            <div className="tc-warning">
              ⛔ O descumprimento destas regras resultará no <strong>cancelamento imediato da conta</strong>, sem
              reembolso, e poderá implicar responsabilização civil e criminal.
            </div>
          </section>

          {/* 6 */}
          <section className="tc-section">
            <h2 className="tc-section-title">6. Pagamentos</h2>
            <ul>
              <li>Todos os pagamentos são processados por gateways seguros e certificados</li>
              <li>Os preços exibidos já incluem os impostos aplicáveis</li>
              <li>Aceitamos cartão de crédito, débito, Pix e outros meios disponibilizados pelo gateway</li>
              <li>A Figuri não armazena dados de cartão de crédito — estas informações são gerenciadas exclusivamente pelo gateway de pagamento</li>
              <li>Em caso de falha no pagamento, o pedido não será processado e nenhuma cobrança será realizada</li>
            </ul>
          </section>

          {/* 7 */}
          <section className="tc-section">
            <h2 className="tc-section-title">7. Política de reembolso e cancelamento</h2>
            <p>
              Como o serviço principal envolve geração de conteúdo digital personalizado, aplicamos as seguintes regras:
            </p>
            <ul>
              <li>
                <strong>Figurinha digital:</strong> após o download ou visualização da imagem gerada em alta resolução,
                não há direito a reembolso (produto digital personalizado, conforme art. 49 do CDC para produtos digitais)
              </li>
              <li>
                <strong>Figurinha física:</strong> caso o produto chegue com defeito de impressão ou dano dos Correios,
                refazemos ou reembolsamos integralmente
              </li>
              <li>
                <strong>Falha técnica na geração:</strong> se a IA não conseguir gerar a figurinha por problema nosso,
                você tem direito a nova tentativa gratuita ou reembolso total
              </li>
              <li>
                <strong>Prazo para reclamação:</strong> até <strong>7 dias corridos</strong> após a compra para
                solicitar reembolso por motivo técnico
              </li>
            </ul>
            <p>
              Para solicitar reembolso, entre em contato pelo e-mail{' '}
              <a href="mailto:suporte@figuri.com.br" style={{ color: '#396100', fontWeight: 600 }}>suporte@figuri.com.br</a>{' '}
              informando o número do pedido.
            </p>
          </section>

          {/* 8 */}
          <section className="tc-section">
            <h2 className="tc-section-title">8. Entrega do produto físico</h2>
            <ul>
              <li>A entrega é realizada pelos Correios para todo o Brasil</li>
              <li>O prazo de produção é de até 3 dias úteis após a confirmação do pagamento</li>
              <li>O prazo de entrega varia conforme a região e a modalidade dos Correios escolhida</li>
              <li>Após o envio, fornecemos o código de rastreamento por e-mail</li>
              <li>A Figuri não se responsabiliza por atrasos causados pelos Correios, greves ou eventos de força maior</li>
              <li>Em caso de produto extraviado, abriremos reclamação nos Correios e enviaremos novo produto ou reembolsaremos</li>
            </ul>
          </section>

          {/* 9 */}
          <section className="tc-section">
            <h2 className="tc-section-title">9. Propriedade intelectual</h2>
            <p>
              A marca Figuri, o logotipo, os designs de moldura, o código-fonte da plataforma e os elementos visuais
              desenvolvidos pela Figuri são protegidos por direitos autorais e de propriedade intelectual.
            </p>
            <p>
              A <strong>figurinha gerada com sua foto</strong> é de sua propriedade para uso pessoal. Você <strong>não</strong> pode:
            </p>
            <ul>
              <li>Revender ou comercializar figurinhas geradas pela Figuri como produto próprio</li>
              <li>Usar os modelos de figurinha da Figuri para criar serviços concorrentes</li>
              <li>Remover marcas d&apos;água ou elementos de identificação da plataforma nas imagens</li>
            </ul>
          </section>

          {/* 10 */}
          <section className="tc-section">
            <h2 className="tc-section-title">10. Limitação de responsabilidade</h2>
            <p>A Figuri não se responsabiliza por:</p>
            <ul>
              <li>Resultados gerados por IA que não atendam às expectativas estéticas do usuário (variações são inerentes à tecnologia)</li>
              <li>Uso indevido das figurinhas geradas pelo usuário após o download</li>
              <li>Indisponibilidade temporária do serviço por manutenção, falhas de terceiros ou eventos de força maior</li>
              <li>Danos indiretos, lucros cessantes ou perdas de qualquer natureza decorrentes do uso da plataforma</li>
            </ul>
            <p>
              Nossa responsabilidade total estará limitada ao valor pago pela transação que originou o dano.
            </p>
          </section>

          {/* 11 */}
          <section className="tc-section">
            <h2 className="tc-section-title">11. Disponibilidade do serviço</h2>
            <p>
              A Figuri se esforça para manter a plataforma disponível 24 horas por dia, 7 dias por semana, mas não garante
              disponibilidade ininterrupta. Realizamos manutenções programadas, preferencialmente em horários de baixo acesso,
              e informaremos os usuários com antecedência sempre que possível.
            </p>
            <p>
              O serviço de geração de figurinha depende de APIs de terceiros. Em caso de indisponibilidade desses serviços,
              poderemos solicitar nova tentativa em momento posterior, sem custo adicional.
            </p>
          </section>

          {/* 12 */}
          <section className="tc-section">
            <h2 className="tc-section-title">12. Suspensão e encerramento de conta</h2>
            <p>A Figuri reserva-se o direito de suspender ou encerrar contas que:</p>
            <ul>
              <li>Violem estes Termos e Condições ou a Política de Privacidade</li>
              <li>Realizem tentativas de fraude ou abuso da plataforma</li>
              <li>Utilizem o serviço para fins ilegais ou prejudiciais a terceiros</li>
              <li>Estejam inativas por período superior a 24 meses</li>
            </ul>
            <p>
              Você pode encerrar sua conta a qualquer momento entrando em contato com nosso suporte. Após o encerramento,
              seus dados serão tratados conforme a Política de Privacidade.
            </p>
          </section>

          {/* 13 */}
          <section className="tc-section">
            <h2 className="tc-section-title">13. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas por e-mail ou aviso
              em destaque no site com pelo menos <strong>15 dias de antecedência</strong>. O uso continuado da plataforma
              após este prazo implica aceitação dos novos termos.
            </p>
          </section>

          {/* 14 */}
          <section className="tc-section">
            <h2 className="tc-section-title">14. Lei aplicável e foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de
              <strong> Belo Horizonte/MG</strong> para dirimir quaisquer controvérsias oriundas deste instrumento,
              salvo disposição legal em contrário (ex.: foro do consumidor).
            </p>
            <p>
              Antes de qualquer medida judicial, encorajamos a resolução amigável de conflitos pelo nosso canal de suporte.
            </p>
          </section>

          {/* CONTATO */}
          <div className="tc-contact">
            <h3>💬 Suporte e dúvidas</h3>
            <p>
              Nossa equipe está disponível para esclarecer dúvidas sobre os termos, pedidos ou qualquer aspecto
              do serviço.
            </p>
            <p>
              E-mail:{' '}
              <a href="mailto:suporte@figuri.com.br">suporte@figuri.com.br</a>
            </p>
            <p>
              WhatsApp:{' '}
              <a href="https://wa.me/5531982668673" target="_blank" rel="noopener noreferrer">
                (31) 98266-8673
              </a>
            </p>
          </div>

        </main>

        {/* FOOTER */}
        <footer className="tc-footer">
          <Link href="/" style={{ color: '#5a7a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none', margin: '0 12px' }}>
            ⚽ Início
          </Link>
          <Link href="/politica-de-privacidade" style={{ color: '#5a7a1a', fontSize: 13, fontWeight: 600, textDecoration: 'none', margin: '0 12px' }}>
            Política de Privacidade
          </Link>
          <span style={{ color: '#8aaa3e', fontSize: 12, display: 'block', marginTop: 16 }}>
            © {new Date().getFullYear()} Figuri · Todos os direitos reservados
          </span>
        </footer>

      </div>
    </>
  );
}
