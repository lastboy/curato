import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Scaffold a minimal intentionally-incomplete smoke test fixture project.
 * If the directory already exists, only missing files are created.
 */
export function scaffoldFixture(targetDir: string): string[] {
  const created: string[] = [];

  mkdirSync(join(targetDir, '.claude'), { recursive: true });

  const packageJson = join(targetDir, 'package.json');
  if (!existsSync(packageJson)) {
    writeFileSync(
      packageJson,
      JSON.stringify(
        { name: 'curato-smoke-fixture', version: '0.0.1', description: 'Curato smoke test fixture' },
        null,
        2,
      ) + '\n',
    );
    created.push(packageJson);
  }

  const claudeMd = join(targetDir, 'CLAUDE.md');
  if (!existsSync(claudeMd)) {
    writeFileSync(claudeMd, '# Smoke Fixture\n\nMinimal fixture for smoke testing.\n');
    created.push(claudeMd);
  }

  const settingsLocal = join(targetDir, '.claude', 'settings.local.json');
  if (!existsSync(settingsLocal)) {
    writeFileSync(settingsLocal, '{}\n');
    created.push(settingsLocal);
  }

  return created;
}
