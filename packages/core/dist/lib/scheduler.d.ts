import { Queue, Worker } from 'bullmq';
export declare function getScheduleQueue(): Queue;
export interface ScheduleJobData {
    scheduleId: string;
    documentId: string;
    collection: string;
    tableName: string;
}
export declare function startScheduleWorker(): Worker;
export declare function closeScheduler(): Promise<void>;
//# sourceMappingURL=scheduler.d.ts.map