import { runForever } from './app.js'

// Polling interval in milliseconds (default: 1 hour). Override with the
// WWT_POLL_INTERVAL_MS environment variable in the PM2 app config.
const intervalMs = Number(process.env['WWT_POLL_INTERVAL_MS'] || 3600000);

runForever(intervalMs);
