import { Hono } from 'hono';
import type { CmsConfig } from '@kritano/cms/types';
export declare function getServerApp(): Hono | null;
export declare function createServer(config: CmsConfig): Hono;
export declare function startServer(config: CmsConfig, port?: number): Promise<void>;
//# sourceMappingURL=server.d.ts.map