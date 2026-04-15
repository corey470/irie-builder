/**
 * Ambient declaration so TypeScript accepts CSS side-effect imports
 * (e.g. `import './globals.css'` in app/layout.tsx). Next.js resolves
 * these at build time; this stub is only for tsc.
 */
declare module '*.css';
