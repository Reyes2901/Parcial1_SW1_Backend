// domain/uml-command.ts
// Pure domain types — NO external dependencies (§4 rule #1)

import type {
  ClassKind,
  Cardinality,
  RelationKind,
  UMLAttribute,
} from './uml-model';

export type UMLCommand =
  | {
      type: 'add_class';
      name: string;
      kind?: ClassKind;
      attributes?: Omit<UMLAttribute, 'id'>[];
    }
  | { type: 'rename_class'; classId: string; newName: string }
  | { type: 'delete_class'; classId: string }
  | {
      type: 'add_attribute';
      classId: string;
      name: string;
      dataType: string;
      isPrimaryKey?: boolean;
      isRequired?: boolean;
    }
  | { type: 'remove_attribute'; classId: string; attributeId: string }
  | {
      type: 'add_relation';
      kind: RelationKind;
      sourceClass: string;
      targetClass: string;
      sourceCardinality: Cardinality;
      targetCardinality: Cardinality;
    }
  | { type: 'remove_relation'; relationId: string }
  | { type: 'move_class'; classId: string; x: number; y: number };
