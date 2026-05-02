import { Queue, Worker } from 'bullmq';
export declare function getWebhookQueue(): Queue;
export interface WebhookDeliveryJob {
    webhookId: string;
    deliveryId: string;
    url: string;
    secret: string | null;
    payload: WebhookPayload;
    attempt: number;
}
export type WebhookEvent = 'content.created' | 'content.updated' | 'content.published' | 'content.unpublished' | 'content.deleted' | 'media.uploaded' | 'media.deleted' | 'form.submitted' | 'user.created';
export interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    site: string;
    data: Record<string, unknown>;
}
export declare function dispatchWebhookEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<void>;
export declare function sendWebhookDelivery(url: string, payload: Record<string, unknown> | WebhookPayload, secret: string | null): Promise<{
    success: boolean;
    responseCode: number | null;
    responseBody: string;
    durationMs: number;
}>;
export declare function startWebhookWorker(): Worker;
export declare function closeWebhookWorker(): Promise<void>;
//# sourceMappingURL=webhooks.d.ts.map