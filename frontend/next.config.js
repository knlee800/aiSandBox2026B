const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/api/health/:path*',
        destination: 'http://localhost:4000/api/health/:path*',
      },
      {
        source: '/api/health',
        destination: 'http://localhost:4000/api/health',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:4000/api/auth/:path*',
      },
      {
        source: '/api/keys/:path*',
        destination: 'http://localhost:4000/api/keys/:path*',
      },
      {
        source: '/api/keys',
        destination: 'http://localhost:4000/api/keys',
      },
      {
        source: '/api/sessions/:path*',
        destination: 'http://localhost:4001/api/sessions/:path*',
      },
      {
        source: '/api/files/:path*',
        destination: 'http://localhost:4001/api/files/:path*',
      },
      {
        source: '/api/git/:path*',
        destination: 'http://localhost:4001/api/git/:path*',
      },
      {
        source: '/api/preview/:path*',
        destination: 'http://localhost:4001/api/preview/:path*',
      },
      {
        source: '/api/messages/:path*',
        destination: 'http://localhost:4002/api/messages/:path*',
      },
      {
        source: '/api/conversations/:path*',
        destination: 'http://localhost:4002/api/conversations/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

