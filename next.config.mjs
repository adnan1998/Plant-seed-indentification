// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;


/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public', // Destination directory for the PWA files
  register: true, // Register the service worker
  skipWaiting: true, // Skip waiting for service worker updates
  disable: process.env.NODE_ENV === 'development'
  // Other optional parameters you can customize
  //...
});

const nextConfig = {
  reactStrictMode: true, // Or false, based on your preference
  swcMinify: true,
  ...pwaConfig,
}

export default nextConfig;