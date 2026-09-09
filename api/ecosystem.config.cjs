/**
 * pm2 process definition, for running Cloak without Docker.
 *
 *   npm ci --omit=dev
 *   npm run build          # only when running from source
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * One instance, not a cluster: the rate limiter keeps its counters in process
 * memory, so a second worker would silently double every limit.
 */
module.exports = {
  apps: [
    {
      name: 'cloak-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // Config comes from .env, read by the app itself. Listing secrets here
      // would copy them into pm2's dump file.
      env: { NODE_ENV: 'production' },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
