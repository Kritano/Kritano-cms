import type { BlocksFieldOptions, BlockDefinition, FieldDefinition } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class BlocksFieldBuilder extends FieldBuilder<BlocksFieldOptions> {
    constructor(blockDefs: BlockDefinition[]);
}
export declare function blocks(blockDefs: BlockDefinition[]): BlocksFieldBuilder;
export declare function block(name: string, fields: Record<string, FieldBuilder<FieldDefinition>>): BlockDefinition;
//# sourceMappingURL=blocks.d.ts.map