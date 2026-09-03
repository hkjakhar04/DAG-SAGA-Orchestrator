const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logDir = path.join(__dirname, 'logs');
const files = fs.readdirSync(logDir).filter(f => f.startsWith('orchestrator') && f.endsWith('.log'));

const workflows = new Map();
let rollbackFailures = 0;

const parseLogFile = async (file) => {
    const filePath = path.join(logDir, file);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        // Extract timestamp
        const timeMatch = line.match(/^\[(.*?)\]/);
        if (!timeMatch) continue;
        const timestamp = new Date(timeMatch[1]).getTime();

        // Check for Started Run
        const startMatch = line.match(/Started Run ([a-f0-9\-]{36})/);
        if (startMatch) {
            const runId = startMatch[1];
            if (!workflows.has(runId)) workflows.set(runId, { start: timestamp });
            else workflows.get(runId).start = timestamp;
            continue;
        }

        // Check for Completed
        const completeMatch = line.match(/Run ([a-f0-9\-]{36}) Completed Successfully/);
        if (completeMatch) {
            const runId = completeMatch[1];
            if (!workflows.has(runId)) workflows.set(runId, {});
            workflows.get(runId).end = timestamp;
            workflows.get(runId).status = 'Success';
            continue;
        }

        // Check for Failed/Rollback started
        const failMatch = line.match(/Run ([a-f0-9\-]{36}) Failed\. Initiating SAGA Rollback/);
        if (failMatch) {
            const runId = failMatch[1];
            if (!workflows.has(runId)) workflows.set(runId, {});
            workflows.get(runId).status = 'Failed';
            continue;
        }

        // Check for Rollback Complete
        const rollbackMatch = line.match(/\[SAGA Rollback\] Run ([a-f0-9\-]{36}): Rollback Complete/);
        if (rollbackMatch) {
            const runId = rollbackMatch[1];
            if (!workflows.has(runId)) workflows.set(runId, {});
            workflows.get(runId).end = timestamp;
            workflows.get(runId).status = 'RolledBack';
            continue;
        }

        // Check for Rollback Failed
        const rollbackFailMatch = line.match(/\[SAGA Rollback Failed\] Run ([a-f0-9\-]{36})/);
        if (rollbackFailMatch) {
            rollbackFailures++;
            continue;
        }
    }
};

const run = async () => {
    for (const file of files) {
        await parseLogFile(file);
    }

    let started = 0;
    let success = 0;
    let failed = 0;
    let rolledBack = 0;
    let totalLatencyMs = 0;
    let completedCountForLatency = 0;

    for (const [runId, data] of workflows.entries()) {
        if (data.start) started++;
        if (data.status === 'Success') {
            success++;
            if (data.start && data.end) {
                totalLatencyMs += (data.end - data.start);
                completedCountForLatency++;
            }
        }
        if (data.status === 'Failed' && !data.end) failed++; // Failed but rollback not complete
        if (data.status === 'RolledBack') {
            rolledBack++;
            if (data.start && data.end) {
                totalLatencyMs += (data.end - data.start);
                completedCountForLatency++;
            }
        }
    }

    console.log("=== LOAD TEST ANALYSIS ===");
    console.log(`Total Workflows Tracked: ${workflows.size}`);
    console.log(`Workflows Started: ${started}`);
    console.log(`Workflows Succeeded: ${success} (${((success / workflows.size) * 100).toFixed(2)}%)`);
    console.log(`Workflows Rolled Back: ${rolledBack} (${((rolledBack / workflows.size) * 100).toFixed(2)}%)`);
    console.log(`SAGA Rollback Component Failures: ${rollbackFailures}`);
    if (completedCountForLatency > 0) {
        console.log(`Average Latency (Completion/Rollback): ${(totalLatencyMs / completedCountForLatency).toFixed(2)} ms`);
    }
};

run().catch(console.error);
