/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Add trailing slash to ensure consistent routing
  trailingSlash: true,
};

module.exports = nextConfig; 