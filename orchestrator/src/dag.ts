import { TaskDefinition } from './types';

// Kahn's Algorithm to return an array of execution batches (arrays of task IDs that can run in parallel)
export const topologicalSortBatches = (tasks: TaskDefinition[]): string[][] => {
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    const taskMap: Record<string, TaskDefinition> = {};

    tasks.forEach(t => {
        inDegree[t.id] = 0;
        adjList[t.id] = [];
        taskMap[t.id] = t;
    });

    tasks.forEach(t => {
        t.dependencies.forEach(dep => {
            if (!adjList[dep]) adjList[dep] = [];
            adjList[dep].push(t.id);
            inDegree[t.id]++;
        });
    });

    const batches: string[][] = [];
    let currentQueue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);

    while (currentQueue.length > 0) {
        batches.push([...currentQueue]);
        const nextQueue: string[] = [];

        currentQueue.forEach(node => {
            adjList[node].forEach(neighbor => {
                inDegree[neighbor]--;
                if (inDegree[neighbor] === 0) {
                    nextQueue.push(neighbor);
                }
            });
        });

        currentQueue = nextQueue;
    }

    const processedCount = batches.reduce((sum, batch) => sum + batch.length, 0);
    if (processedCount !== tasks.length) {
        throw new Error('Cycle detected in DAG');
    }

    return batches;
};
