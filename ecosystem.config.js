module.exports = {
  apps: [
    {
      name: 'wa-announcements-bot',
      script: 'build/index.js',
      merge_logs: true,
      max_restarts: 3,
      instances: 1,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
