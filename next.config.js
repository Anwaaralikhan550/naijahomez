/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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
  };

  module.exports = nextConfig;