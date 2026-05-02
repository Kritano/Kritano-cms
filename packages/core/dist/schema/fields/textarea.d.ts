import type { TextareaFieldOptions } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class TextareaFieldBuilder extends FieldBuilder<TextareaFieldOptions> {
    constructor();
    maxLength(value: number): this;
}
export declare function textarea(): TextareaFieldBuilder;
//# sourceMappingURL=textarea.d.ts.map