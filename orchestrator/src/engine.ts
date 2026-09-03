import axios from 'axios';
import http from 'http';
import https from 'https';
import { TaskDefinition, WorkflowState } from './types';

// Create a global Axios instance with Keep-Alive to prevent socket exhaustion during load tests
const apiClient = axios.create({
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 500 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 500 }),
});
import { checkRateLimit, sleep } from './RateLimiterClient';
import { getWorkflow, saveWorkflow } from './storage';
import { logger } from './logger';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 200;

// Emitter interface to decouple socket.io
export type StateChangedCallback = (runId: string, state: WorkflowState) => void;
let onStateChanged: StateChangedCallback = () => {};

export const setOnStateChanged = (cb: StateChangedCallback) => {
    onStateChanged = cb;
};

const notifyState = (runId: string) => {
    const state = getWorkflow(runId);
    if (state) {
        onStateChanged(runId, state);
    }
};

const executeTask = async (runId: string, taskDef: TaskDefinition): Promise<void> => {
    const workflow = getWorkflow(runId)!;
    const task = workflow.tasks[taskDef.id];

    task.status = 'Running';
    task.startTime = Date.now();
    notifyState(runId);

    while (task.retries <= MAX_RETRIES) {
        try {
            await checkRateLimit(taskDef.rateLimitKey);
            workflow.tokensUsed = (workflow.tokensUsed || 0) + 1;
            logger.info(`[Token Tracker] Workflow ${runId} consumed token for ${taskDef.rateLimitKey} (Total: ${workflow.tokensUsed})`);

            // Execute the mock API call
            const response = await apiClient.post(taskDef.endpoint);
            task.result = response.data;
            task.status = 'Success';
            task.endTime = Date.now();
            notifyState(runId);
            return;
        } catch (error: any) {
            task.retries++;
            const is500 = error.response && error.response.status === 500;
            const errorMsg = error.response ? error.response.data.error || 'Server Error' : error.message;
            
            logger.warn(`[Task Failed] ${taskDef.id} in Run ${runId}. Retry ${task.retries}/${MAX_RETRIES}. Error: ${errorMsg}`);
            
            if (task.retries > MAX_RETRIES) {
                task.status = 'Failed';
                task.error = errorMsg;
                task.endTime = Date.now();
                notifyState(runId);
                throw new Error(`Task ${taskDef.id} failed after ${MAX_RETRIES} retries`);
            }

            // Exponential Backoff with jitter
            const backoffMs = BASE_BACKOFF_MS * Math.pow(2, task.retries - 1) + (Math.random() * 50);
            await sleep(backoffMs);
        }
    }
};

const compensateTask = async (runId: string, taskDef: TaskDefinition): Promise<void> => {
    const workflow = getWorkflow(runId)!;
    const task = workflow.tasks[taskDef.id];

    if (task.status !== 'Success') return; // Only compensate successful tasks

    logger.info(`[SAGA Rollback] Run ${runId}: Compensating task ${taskDef.id}...`);
    task.status = 'Compensating';
    notifyState(runId);

    try {
        await apiClient.post(taskDef.compensateEndpoint);
        logger.info(`[SAGA Rollback] Run ${runId}: Task ${taskDef.id} compensated successfully.`);
        task.status = 'Compensated';
    } catch (error: any) {
        logger.error(`[SAGA Rollback Failed] Run ${runId}: Failed to compensate task ${taskDef.id}: ${error.message}`);
        task.status = 'Compensated'; 
    }
    
    notifyState(runId);
};

export const executeWorkflow = async (runId: string, tasks: TaskDefinition[], batches: string[][]) => {
    const workflow = getWorkflow(runId)!;
    logger.info(`[DAG Engine] Started Run ${runId} with ${batches.length} parallel batches.`);

    try {
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (workflow.status === 'Failed') break;

            logger.info(`[DAG Engine] Run ${runId}: Executing Batch ${i + 1} (${batch.join(', ')})`);

            const promises = batch.map(taskId => {
                const taskDef = tasks.find(t => t.id === taskId)!;
                return executeTask(runId, taskDef);
            });

            await Promise.all(promises);
        }

        workflow.status = 'Completed';
        workflow.endTime = Date.now();
        logger.info(`[DAG Engine] Run ${runId} Completed Successfully.`);
        notifyState(runId);
        
    } catch (error: any) {
        logger.error(`[DAG Engine] Run ${runId} Failed. Initiating SAGA Rollback. Reason: ${error.message}`);
        workflow.status = 'Compensating';
        notifyState(runId);

        const reversedBatches = [...batches].reverse();
        
        for (let i = 0; i < reversedBatches.length; i++) {
            const batch = reversedBatches[i];
            const promises = batch.map(taskId => {
                const taskDef = tasks.find(t => t.id === taskId)!;
                return compensateTask(runId, taskDef);
            });
            await Promise.allSettled(promises);
        }

        workflow.status = 'RolledBack';
        workflow.endTime = Date.now();
        logger.info(`[SAGA Rollback] Run ${runId}: Rollback Complete.`);
        notifyState(runId);
    }
};
