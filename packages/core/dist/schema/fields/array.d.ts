import type { ArrayFieldOptions, FieldDefinition } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class ArrayFieldBuilder extends FieldBuilder<ArrayFieldOptions> {
    constructor(of: FieldBuilder<FieldDefinition>);
}
export declare function array(of: FieldBuilder<FieldDefinition>): ArrayFieldBuilder;
//# sourceMappingURL=array.d.ts.map