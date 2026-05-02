import type { Context } from 'hono';
export declare function errorHandler(err: Error, c: Context): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
        field?: string | undefined;
    };
}, 500, "json">;
//# sourceMappingURL=error.d.ts.map