import axios from 'axios';
import http from 'http';

// The HTTP Keep-Alive agent is CRITICAL to prevent Windows TCP socket exhaustion
// when firing thousands of requests to the rate limiter. We must also cap maxSockets
// to prevent the C++ server from spawning thousands of threads.
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });

const rateLimiterClient = axios.create({
    baseURL: 'http://localhost:8080',
    httpAgent: keepAliveAgent,
    timeout: 0 // Infinite timeout to prevent fail-open during massive queueing
});

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const checkRateLimit = async (key: string): Promise<void> => {
    try {
        const response = await rateLimiterClient.post('/check', { key });
        const { allowed, waitForMs } = response.data;
        
        if (!allowed && waitForMs > 0) {
            // Traffic Pacing: Wait exactly the required amount of time before proceeding
            await sleep(waitForMs);
        }
    } catch (error: any) {
        // Fail-Open Design: If the rate limiter crashes or times out, proceed instantly
        console.warn(`[Rate Limiter] Fail-open triggered for key ${key}:`, error.message);
    }
};
