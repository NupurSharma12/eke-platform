/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // pdf-parse (via pdfjs-dist) fails webpack's static export analysis
  // ("export 'PDFDateString' ... was not found") when bundled — this
  // was previously avoided only by routes that didn't actually need
  // parseDocument(). app/api/eke/analyze-material/route.ts is the
  // first route that genuinely does, and hits it directly regardless
  // of import style. Marking it external makes Next require() it at
  // runtime on the server instead of bundling it through webpack.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

module.exports = nextConfig;
