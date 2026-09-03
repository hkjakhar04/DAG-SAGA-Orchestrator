export type TaskStatus = 'Pending' | 'Running' | 'Success' | 'Failed' | 'Compensating' | 'Compensated' | 'Skipped';

export interface TaskDefinition {
    id: string;
    endpoint: string;
    compensateEndpoint: string;
    dependencies: string[]; // List of task IDs this task depends on
    rateLimitKey: string;
}

export interface TaskState extends TaskDefinition {
    status: TaskStatus;
    result?: any;
    error?: string;
    startTime?: number;
    endTime?: number;
    retries: number;
}

export interface WorkflowState {
    runId: string;
    status: 'Running' | 'Completed' | 'Failed' | 'Compensating' | 'RolledBack';
    tasks: Record<string, TaskState>;
    startTime: number;
    endTime?: number;
    tokensUsed?: number;
}
