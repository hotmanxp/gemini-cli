#!/usr/bin/env node
/* global console, process, setTimeout */

/**
 * Profile gemini CLI startup to find bottlenecks
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';

const startTime = performance.now();

console.log('Starting Gemini CLI...\n');

// Start gemini CLI with --prompt flag but no actual work
const child = spawn('node', ['--trace-warnings', 'packages/cli/dist/index.js', '--prompt', 'exit'], {
  cwd: '/Users/ethan/code/gemini-cli',
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, DEBUG: 'true' },
});

const rl = readline.createInterface({
  input: child.stderr,
  crlfDelay: Infinity,
});

let lineCount = 0;
const maxLines = 50;

rl.on('line', (line) => {
  lineCount++;
  const time = (performance.now() - startTime).toFixed(2);
  console.log(`[${time}ms] ${line}`);
  
  if (lineCount >= maxLines) {
    child.kill('SIGTERM');
    console.log('\n[Timeout] Too many lines, stopping...');
  }
});

child.on('close', (code) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`\n=== Summary ===`);
  console.log(`Total time: ${duration.toFixed(2)}ms`);
  console.log(`Exit code: ${code}`);
  console.log(`Lines output: ${lineCount}`);
});

setTimeout(() => {
  child.kill('SIGTERM');
  console.log('\n[Timeout] 10s reached');
  process.exit(0);
}, 10000);
