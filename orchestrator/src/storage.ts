import { WorkflowState } from './types';

// The in-memory native Map database
export const database = new Map<string, WorkflowState>();

export const saveWorkflow = (runId: string, state: WorkflowState) => {
    database.set(runId, state);
};

export const getWorkflow = (runId: string): WorkflowState | undefined => {
    return database.get(runId);
};

export const getAllWorkflows = (): WorkflowState[] => {
    return Array.from(database.values());
};
