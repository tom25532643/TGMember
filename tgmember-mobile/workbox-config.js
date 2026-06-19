const buildDir = process.env.WEB_BUILD_DIR || 'dist';

module.exports = {
  globDirectory: `${buildDir}/`,
  globPatterns: ['**/*.{html,js,css,json,png,jpg,jpeg,svg,ico,webp,woff,woff2,ttf}'],
  swDest: `${buildDir}/service-worker.js`,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  navigateFallback: '/index.html',
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'tgmember-pages',
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: ({ request }) => ['script', 'style', 'font', 'image'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'tgmember-static-assets',
      },
    },
  ],
};