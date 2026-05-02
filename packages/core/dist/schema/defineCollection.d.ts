import type { CollectionDefinition, FieldDefinition } from '@kritano/cms/types';
import { FieldBuilder } from './fields/builder';
export declare function defineCollection(name: string, options: {
    fields: Record<string, FieldBuilder<FieldDefinition>>;
}): CollectionDefinition;
//# sourceMappingURL=defineCollection.d.ts.map