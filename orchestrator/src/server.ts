import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { TaskDefinition, WorkflowState } from './types';
import { topologicalSortBatches } from './dag';
import { executeWorkflow, setOnStateChanged } from './engine';
import { saveWorkflow, getAllWorkflows } from './storage';
import { logger } from './logger';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

// Set up engine callbacks to emit over sockets
setOnStateChanged((runId, state) => {
    io.emit('taskStateChanged', { runId, state });
});

// The standard Travel Booking Workflow as requested
const workflowPath = path.resolve(process.cwd(), 'orchestrator', 'workflow.json');
let WORKFLOW_DEF: TaskDefinition[] = [];
try {
    const data = fs.readFileSync(workflowPath, 'utf8');
    WORKFLOW_DEF = JSON.parse(data);
    logger.info(`Loaded ${WORKFLOW_DEF.length} tasks from workflow.json.`);
} catch (error: any) {
    logger.error(`Failed to load workflow.json: ${error.message}`);
    process.exit(1);
}

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

    saveWorkflow(runId, state);

    // Asynchronously execute workflow to free up HTTP connection immediately
    executeWorkflow(runId, WORKFLOW_DEF, batches).catch((err) => logger.error(err.message));

    // Return the runId immediately
    res.json({ runId, message: 'Workflow started' });
});

app.get('/api/history', (req, res) => {
    const workflows = getAllWorkflows();
    res.json(workflows);
});

const PORT = 3000;
server.listen(PORT, () => {
    logger.info(`Orchestrator running on http://localhost:${PORT}`);
});
