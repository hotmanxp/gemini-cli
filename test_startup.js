#!/usr/bin/env node
/* global console, setTimeout, process */

/**
 * Fast startup test - measure time to first UI render
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const startTime = performance.now();

// Start gemini CLI with a simple prompt
const child = spawn('node', ['packages/cli/dist/index.js', '--prompt', 'echo test'], {
  cwd: '/Users/ethan/code/gemini-cli',
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
});

child.on('close', (code) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`\n=== Startup Performance Test ===`);
  console.log(`Total execution time: ${duration.toFixed(2)}ms`);
  console.log(`Exit code: ${code}`);
  console.log(`Stdout length: ${stdout.length}`);
  console.log(`Stderr length: ${stderr.length}`);
  
  // Check if CLI started successfully
  if (stderr.includes('Initializing') || stderr.includes('LSP')) {
    console.log('✓ CLI started and initialized');
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  child.kill('SIGTERM');
  console.log('Timeout after 10s');
  process.exit(1);
}, 10000);
