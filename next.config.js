/** @type {import('next').NextConfig} */
const nextConfig = {
  // index.html is served by vercel.json rewrite, not by Next.js
  // The app directory handles /dashboard and /api/*

  // Ensure Vercel bundles the markdown reference docs with the generate
  // function so the agent system can fs.readFileSync them at runtime.
  outputFileTracingIncludes: {
    '/api/generate': ['./DESIGN.md', './PSYCHOLOGY.md', './DESIGN_DIRECTIONS.md'],
    '/api/generate/status': ['./DESIGN.md', './PSYCHOLOGY.md', './DESIGN_DIRECTIONS.md'],
  },
}

module.exports = nextConfig
