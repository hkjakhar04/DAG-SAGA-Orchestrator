import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import cluster from 'cluster';
import os from 'os';
import { TaskDefinition, WorkflowState } from './types';
import { topologicalSortBatches } from './dag';
import { executeWorkflow, setOnStateChanged } from './engine';
import { saveWorkflow } from './storage';
import { logger } from './logger';

// Load workflow definition once
const workflowPath = path.resolve(process.cwd(), 'orchestrator', 'workflow.json');
let WORKFLOW_DEF: TaskDefinition[] = [];
try {
    const data = fs.readFileSync(workflowPath, 'utf8');
    WORKFLOW_DEF = JSON.parse(data);
} catch (error: any) {
    logger.error(`Failed to load workflow.json: ${error.message}`);
    process.exit(1);
}

if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    logger.info(`[Cluster] Primary ${process.pid} is running`);

    const globalHistory = new Map<string, any>();

    const app = express();
    app.use(cors());
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });

    app.get('/api/history', (req, res) => {
        res.json(Array.from(globalHistory.values()));
    });

    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        worker.on('message', (msg) => {
            if (msg.type === 'STATE_UPDATE') {
                globalHistory.set(msg.runId, msg.state);
                io.emit('taskStateChanged', { runId: msg.runId, state: msg.state });
            }
        });
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`[Cluster] Worker ${worker.process.pid} died. Restarting...`);
        const newWorker = cluster.fork();
        newWorker.on('message', (msg) => {
            if (msg.type === 'STATE_UPDATE') {
                globalHistory.set(msg.runId, msg.state);
                io.emit('taskStateChanged', { runId: msg.runId, state: msg.state });
            }
        });
    });

    const PORT = 3001; // Primary Dashboard API
    server.listen(PORT, () => {
        logger.info(`[Cluster] Primary Dashboard API running on http://localhost:${PORT}`);
    });

} else {
    // Worker processes
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Send state updates to Primary via IPC
    setOnStateChanged((runId, state) => {
        if (process.send) {
            process.send({ type: 'STATE_UPDATE', runId, state });
        }
    });

    app.post('/api/start', (req, res) => {
        const runId = uuidv4();
        let batches: string[][];
        try {
            batches = topologicalSortBatches(WORKFLOW_DEF);
        } catch (e: any) {
            return res.status(400).json({ error: e.message });
        }

        const state: WorkflowState = {
            runId,
            status: 'Running',
            startTime: Date.now(),
            tasks: {}
        };

        WORKFLOW_DEF.forEach(t => {
            state.tasks[t.id] = { ...t, status: 'Pending', retries: 0 };
        });

        // Save local copy for DAG Engine access
        saveWorkflow(runId, state);

        // Notify Primary to update global copy and emit Socket.io
        if (process.send) {
            process.send({ type: 'STATE_UPDATE', runId, state });
        }

        // Asynchronously execute workflow to free up HTTP connection immediately
        executeWorkflow(runId, WORKFLOW_DEF, batches).catch((err) => logger.error(err.message));

        res.json({ runId, message: 'Workflow started' });
    });

    const PORT = 3000;
    app.listen(PORT, () => {
        logger.info(`[Cluster] Worker ${process.pid} listening on port ${PORT}`);
    });
}
