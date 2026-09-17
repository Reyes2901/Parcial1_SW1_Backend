// domain/uml-model.ts
// Pure domain types — NO external dependencies (§4 rule #1)

export type Visibility = 'public' | 'private' | 'protected' | 'package';
export type ClassKind = 'class' | 'abstract' | 'interface' | 'enumeration';

export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
  isPrimaryKey: boolean;
  isRequired: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

export interface UMLMethod {
  id: string;
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  visibility: Visibility;
}

export interface UMLClass {
  id: string;
  name: string;
  kind: ClassKind;
  attributes: UMLAttribute[];
  methods: UMLMethod[];
  position: { x: number; y: number };
}

export type RelationKind =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'inheritance'
  | 'realization'
  | 'dependency';

export type Cardinality = '1' | '0..1' | '1..*' | '0..*' | '*';

export interface UMLRelation {
  id: string;
  kind: RelationKind;
  sourceClassId: string;
  targetClassId: string;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  sourceRole?: string;
  targetRole?: string;
  name?: string;
}

export interface UMLModel {
  id: string;
  name: string;
  version: number;
  classes: UMLClass[];
  relations: UMLRelation[];
}
