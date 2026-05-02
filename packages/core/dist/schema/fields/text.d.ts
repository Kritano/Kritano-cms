import type { TextFieldOptions } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class TextFieldBuilder extends FieldBuilder<TextFieldOptions> {
    constructor();
    min(value: number): this;
    max(value: number): this;
    pattern(value: string): this;
}
export declare function text(): TextFieldBuilder;
//# sourceMappingURL=text.d.ts.map