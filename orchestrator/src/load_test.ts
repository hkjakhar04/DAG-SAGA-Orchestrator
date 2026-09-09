import axios from 'axios';
import http from 'http';
import https from 'https';

const apiClient = axios.create({
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 500 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 500 }),
});

const TOTAL_WORKFLOWS = 5000;
const CONCURRENT_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 50;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoadTest() {
    console.log(`Starting massive load test: ${TOTAL_WORKFLOWS} workflows...`);
    const startTime = Date.now();

    // Fire and forget to blast the orchestrator instantly
    for (let i = 0; i < TOTAL_WORKFLOWS; i++) {
        apiClient.post('http://localhost:3000/api/start').catch(() => {});
        if (i % 1000 === 0) console.log(`Dispatched ${i} / ${TOTAL_WORKFLOWS}`);
    }

    const endTime = Date.now();
    console.log(`Dispatched all ${TOTAL_WORKFLOWS} in ${endTime - startTime}ms!`);
    console.log(`Check the dashboard. The orchestrator will now drain the queue at 300 TPS.`);
}

runLoadTest();
