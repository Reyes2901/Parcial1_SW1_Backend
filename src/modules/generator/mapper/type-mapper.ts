// modules/generator/mapper/type-mapper.ts
// Type mapping rules per AGENTS.md §7.7

export interface TypeMapping {
  javaType: string;
  sqlType: string;
  importPackage?: string;
}

const TYPE_MAP: Record<string, TypeMapping> = {
  String: { javaType: 'String', sqlType: 'VARCHAR(255)' },
  string: { javaType: 'String', sqlType: 'VARCHAR(255)' },
  Integer: { javaType: 'Integer', sqlType: 'INTEGER' },
  int: { javaType: 'Integer', sqlType: 'INTEGER' },
  Long: { javaType: 'Long', sqlType: 'BIGINT' },
  long: { javaType: 'Long', sqlType: 'BIGINT' },
  Double: { javaType: 'Double', sqlType: 'DOUBLE PRECISION' },
  double: { javaType: 'Double', sqlType: 'DOUBLE PRECISION' },
  BigDecimal: {
    javaType: 'BigDecimal',
    sqlType: 'NUMERIC(19,2)',
    importPackage: 'java.math.BigDecimal',
  },
  Boolean: { javaType: 'Boolean', sqlType: 'BOOLEAN' },
  boolean: { javaType: 'Boolean', sqlType: 'BOOLEAN' },
  LocalDate: {
    javaType: 'LocalDate',
    sqlType: 'DATE',
    importPackage: 'java.time.LocalDate',
  },
  LocalDateTime: {
    javaType: 'LocalDateTime',
    sqlType: 'TIMESTAMP',
    importPackage: 'java.time.LocalDateTime',
  },
  UUID: {
    javaType: 'UUID',
    sqlType: 'UUID',
    importPackage: 'java.util.UUID',
  },
};

export function mapUMLTypeToJava(umlType: string): TypeMapping {
  const normalized = umlType.trim();
  const mapped = TYPE_MAP[normalized];
  if (mapped) return mapped;

  // Fallback to String for unrecognized primitive types
  return { javaType: 'String', sqlType: 'VARCHAR(255)' };
}
