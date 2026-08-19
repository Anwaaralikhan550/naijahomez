/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // isomorphic-dompurify pulls in jsdom, which breaks when webpack bundles it
    // for the server: /housemate/[slug] returned a 500 with
    // "TypeError: s is not a function at t.createWindow". Loading it from
    // node_modules at runtime instead keeps DOMPurify's real sanitiser rather
    // than downgrading those pages to a regex clean-up.
    serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
    // Configure ESLint to not fail build on warnings
    eslint: {
      // Warning: This allows production builds to successfully complete even if
      // ESLint config has serialization issues
      ignoreDuringBuilds: false,
    },
    images: {
      // Disable optimization for pre-processed images
      unoptimized: true,
      // If you want to keep some optimization, use these reduced settings:
      // deviceSizes: [640, 828, 1200],
      // imageSizes: [64, 128, 256],
      domains: ['nijahomzs.s3.eu-north-1.amazonaws.com'],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'nijahomzs.s3.eu-north-1.amazonaws.com',
          port: '',
          pathname: '/uploads/**',
        },
        {
          protocol: 'https',
          hostname: 'nijahomzs.s3.eu-north-1.amazonaws.com',
          port: '',
          pathname: '/properties/**',
        },
        // Add other image hostnames as needed
        {
          protocol: 'https',
          hostname: 'nijahomzs.s3.amazonaws.com',
          port: '',
          pathname: '/properties/**',
        },
        {
          protocol: 'https',
          hostname: 'images.nigeriapropertycentre.com',
          port: '',
          pathname: '/properties/images/**',
        },
        // Placeholder image configuration
        {
          protocol: 'https',
          hostname: 'nijahomzs.com',
          port: '',
          pathname: '/api/placeholder/**',
        }
      ]
    },
    // Webpack configuration removed - all Firebase client imports eliminated
    async redirects() {
      return [
        {
          source: '/the-hub',
          destination: '/dashboard/community',
          permanent: false,
        },
        {
          source: '/the-hub/:path*',
          destination: '/dashboard/community/:path*',
          permanent: false,
        },
      ];
    },
    async rewrites() {
      return [
        {
          source: '/dashboard/community',
          destination: '/the-hub',
        },
        {
          source: '/dashboard/community/:path*',
          destination: '/the-hub/:path*',
        },
      ];
    },
  };

  module.exports = nextConfig;
