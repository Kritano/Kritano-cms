import type { SlugFieldOptions } from '@kritano/cms/types';
import { FieldBuilder } from './builder';
export declare class SlugFieldBuilder extends FieldBuilder<SlugFieldOptions> {
    constructor();
    from(fieldName: string): this;
}
export declare function slug(): SlugFieldBuilder;
//# sourceMappingURL=slug.d.ts.map