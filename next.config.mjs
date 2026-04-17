/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      { source: "/gerar", destination: "/gerar.html" },
      { source: "/editor", destination: "/editor.html" },
      { source: "/carrinho", destination: "/carrinho.html" },
      { source: "/comprar", destination: "/comprar.html" },
      { source: "/admin", destination: "/admin.html" },
      { source: "/termos", destination: "/termos.html" },
      { source: "/privacidade", destination: "/privacidade.html" },
    ];
  },
};

export default nextConfig;
