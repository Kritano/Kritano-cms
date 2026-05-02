import type { NumberFieldOptions } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class NumberFieldBuilder extends FieldBuilder<NumberFieldOptions> {
    constructor();
    min(value: number): this;
    max(value: number): this;
    integer(): this;
}
export declare function number(): NumberFieldBuilder;
//# sourceMappingURL=number.d.ts.map