import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testFiles = readdirSync(resolve('tests'))
  .filter((fileName) => fileName.endsWith('.test.js'))
  .sort()
  .map((fileName) => resolve('tests', fileName));

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
