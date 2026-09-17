import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Reference Spring Boot Project', () => {
  it('compiles reference project with 3 entities and cardinalities using mvn -q compile', () => {
    const projectRoot = path.join(__dirname, '../reference-project');

    let compileSuccess = false;
    try {
      execSync('mvn -q compile', { cwd: projectRoot, stdio: 'pipe' });
      compileSuccess = true;
    } catch (err: any) {
      console.error('mvn compile stdout/stderr:', err.stdout?.toString(), err.stderr?.toString());
      compileSuccess = false;
    }

    expect(compileSuccess).toBe(true);
  });
});
