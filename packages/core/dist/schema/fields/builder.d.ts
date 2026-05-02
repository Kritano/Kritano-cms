import type { FieldDefinition } from '@kritano/cms/types';
export declare class FieldBuilder<T extends FieldDefinition = FieldDefinition> {
    protected _def: T;
    constructor(def: T);
    required(): this;
    nullable(): this;
    default(value: unknown): this;
    toDefinition(): T;
}
//# sourceMappingURL=builder.d.ts.map