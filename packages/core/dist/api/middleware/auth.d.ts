import type { JwtPayload } from '@kritano/cms/types';
export type AuthEnv = {
    Variables: {
        user: JwtPayload;
        apiKeyScopes: string[] | null;
    };
};
export declare function verifyToken(token: string): JwtPayload;
export declare function signToken(payload: {
    sub: string;
    email: string;
}, expiresIn?: string): string;
export declare function signRefreshToken(payload: {
    sub: string;
    email: string;
}): string;
export declare const requireAuth: import("hono").MiddlewareHandler<AuthEnv, string, {}, Response>;
export declare const optionalAuth: import("hono").MiddlewareHandler<AuthEnv, string, {}, Response>;
export declare function requireScope(scope: string): import("hono").MiddlewareHandler<AuthEnv, string, {}, Response>;
//# sourceMappingURL=auth.d.ts.map