// domain/index.ts
// Barrel export for domain types — keeps imports clean

export type {
  Visibility,
  ClassKind,
  UMLAttribute,
  UMLMethod,
  UMLClass,
  RelationKind,
  Cardinality,
  UMLRelation,
  UMLModel,
} from './uml-model';

export type { UMLCommand } from './uml-command';

export {
  isValidJavaIdentifier,
  isValidClassName,
  detectInheritanceCycles,
  validateCommand,
  validateCommands,
} from './validator';
export type { ValidationError } from './validator';

export { applyCommand, applyCommands } from './applier';
