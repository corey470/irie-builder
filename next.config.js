/** @type {import('next').NextConfig} */
const nextConfig = {
  // index.html is served by vercel.json rewrite, not by Next.js
  // The app directory handles /dashboard and /api/*

  experimental: {
    // Next 14 expects output file tracing includes under experimental.
    // These docs are read from process.cwd() at runtime by md-loader.
    outputFileTracingIncludes: {
      '/api/generate': ['./DESIGN.md', './PSYCHOLOGY.md', './DESIGN_DIRECTIONS.md'],
      '/api/generate/status': ['./DESIGN.md', './PSYCHOLOGY.md', './DESIGN_DIRECTIONS.md'],
    },
  },
}

module.exports = nextConfig
