// modules/generator/mapper/naming.ts
// Naming conventions helper for Spring Boot generator

export function toPascalCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  if (!pascal) return '';
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_');
}

export function toPluralSnakeCase(str: string): string {
  const snake = toSnakeCase(str);
  if (snake.endsWith('s') || snake.endsWith('x') || snake.endsWith('z') || snake.endsWith('ch') || snake.endsWith('sh')) {
    return `${snake}es`;
  }
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) {
    return `${snake.slice(0, -1)}ies`;
  }
  return `${snake}s`;
}
