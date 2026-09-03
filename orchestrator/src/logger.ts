import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists at the root of the project
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, errors } = winston.format;

const readableFormat = combine(
    timestamp(),
    printf(({ level, message, timestamp, component, ...meta }) => {
        let log = `[${timestamp}] [${component || 'Orchestrator'}] ${level.toUpperCase()}: ${message}`;

        const metaCopy = { ...meta };
        delete metaCopy.service;

        if (Object.keys(metaCopy).length > 0) {
            log += ` ${JSON.stringify(metaCopy)}`;
        }

        return log;
    })
);

export const logger = winston.createLogger({
    level: 'info',
    format: combine(
        errors({ stack: true }),
        readableFormat
    ),
    defaultMeta: { service: 'SAGA_ORCHESTRATOR' },
    transports: [
        // Write all logs to `logs/orchestrator.log`
        new winston.transports.File({
            filename: path.join(logDir, 'orchestrator.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write error logs to `logs/error.log`
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
});
