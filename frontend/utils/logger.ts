/**
 * Simple Logger wrapper to prevent console pollution in production.
 * Only logs in development environment.
 */
const isDev = process.env.NODE_ENV === 'development';

export const Logger = {
    log: (...args: unknown[]) => {
        if (isDev) console.info(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
    error: (...args: unknown[]) => {
        // Errors are critical, so we might want to keep them or at least log them uniquely.
        // For now, we pass them through but we could wrap them if needed.
        console.error(...args);
    },
    info: (...args: unknown[]) => {
        if (isDev) console.info(...args);
    }
};
