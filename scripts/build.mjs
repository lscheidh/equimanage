#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const vitePath = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const args = process.argv.includes('--dev') ? [] : ['build'];

const child = spawn(process.execPath, [vitePath, ...args], {
  cwd: projectRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
