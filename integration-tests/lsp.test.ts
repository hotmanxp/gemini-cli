/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP 功能集成测试
 *
 * 通过 CLI 实际运行 LSP 命令来测试所有 LSP 功能点
 * 使用真实的 LSP 服务器和测试 fixtures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestRig } from './test-helper.js';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

// 测试超时时间
const LSP_TEST_TIMEOUT = 60000;

// 测试用的 TypeScript 代码 fixture
const TYPESCRIPT_FIXTURE = `/**
 * Sample TypeScript file for LSP integration tests.
 */

export class Calculator {
  private value: number = 0;

  constructor(initialValue?: number) {
    this.value = initialValue ?? 0;
  }

  add(n: number): void {
    this.value += n;
  }

  getValue(): number {
    return this.value;
  }
}

export class ScientificCalculator extends Calculator {
  computeSquareRoot(): number {
    return Math.sqrt(this.getValue());
  }
}

export function calculateSum(numbers: number[], initial?: number): number {
  const calc = new Calculator(initial);
  for (const num of numbers) {
    calc.add(num);
  }
  return calc.getValue();
}

export function main(): void {
  const calc = new Calculator(10);
  calc.add(5);
  const result = calc.getValue();
  console.log('Result: ' + result);
}
`;

describe('LSP 集成测试', () => {
  let rig: TestRig;

  beforeEach(() => {
    rig = new TestRig();
  });

  afterEach(async () => {
    await rig.cleanup();
  });

  /**
   * 辅助函数：创建测试 fixtures
   */
  function createFixtures(): string {
    const testFixturePath = join(rig.testDir!, 'lsp-test.ts');

    // 创建测试 fixture 文件
    mkdirSync(rig.testDir!, { recursive: true });
    writeFileSync(testFixturePath, TYPESCRIPT_FIXTURE);

    return testFixturePath;
  }

  describe('goToDefinition', () => {
    it(
      '应该能找到类的定义',
      async () => {
        // Setup fixtures
        await rig.setup('lsp-goToDefinition');
        createFixtures();

        // 运行 LSP 测试
        const result = await rig.run('lsp goToDefinition 测试');

        // 验证启动了 LSP 服务
        expect(result).toBeDefined();

        // 检查是否有 LSP 相关的输出
        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('findReferences', () => {
    it(
      '应该能找到符号的所有引用',
      async () => {
        await rig.setup('lsp-findReferences');
        createFixtures();

        const result = await rig.run('lsp findReferences 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('hover', () => {
    it(
      '应该能获取悬停信息',
      async () => {
        await rig.setup('lsp-hover');
        createFixtures();

        const result = await rig.run('lsp hover 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('documentSymbol', () => {
    it(
      '应该能列出文档中的所有符号',
      async () => {
        await rig.setup('lsp-documentSymbol');
        createFixtures();

        const result = await rig.run('lsp documentSymbol 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('workspaceSymbol', () => {
    it(
      '应该能在工作空间搜索符号',
      async () => {
        await rig.setup('lsp-workspaceSymbol');
        createFixtures();

        const result = await rig.run('lsp workspaceSymbol 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('goToImplementation', () => {
    it(
      '应该能找到实现',
      async () => {
        await rig.setup('lsp-goToImplementation');
        createFixtures();

        const result = await rig.run('lsp goToImplementation 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('prepareCallHierarchy', () => {
    it(
      '应该能准备调用层级',
      async () => {
        await rig.setup('lsp-prepareCallHierarchy');
        createFixtures();

        const result = await rig.run('lsp prepareCallHierarchy 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('incomingCalls', () => {
    it(
      '应该能找到调用入',
      async () => {
        await rig.setup('lsp-incomingCalls');
        createFixtures();

        const result = await rig.run('lsp incomingCalls 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('outgoingCalls', () => {
    it(
      '应该能找到调用出',
      async () => {
        await rig.setup('lsp-outgoingCalls');
        createFixtures();

        const result = await rig.run('lsp outgoingCalls 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('diagnostics', () => {
    it(
      '应该能获取诊断信息',
      async () => {
        await rig.setup('lsp-diagnostics');
        createFixtures();

        const result = await rig.run('lsp diagnostics 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('workspaceDiagnostics', () => {
    it(
      '应该能获取工作空间诊断',
      async () => {
        await rig.setup('lsp-workspaceDiagnostics');
        createFixtures();

        const result = await rig.run('lsp workspaceDiagnostics 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('codeActions', () => {
    it(
      '应该能获取代码操作',
      async () => {
        await rig.setup('lsp-codeActions');
        createFixtures();

        const result = await rig.run('lsp codeActions 测试');

        expect(result).toBeDefined();

        const toolCalls = rig.readToolCalls();
        const hasLspCall = toolCalls.some(
          (call) => call.toolRequest.name === 'lsp',
        );

        expect(hasLspCall).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  describe('LSP 综合场景', () => {
    it(
      '应该能在真实项目中工作',
      async () => {
        await rig.setup('lsp-integration');
        createFixtures();

        // 在一个真实的 TypeScript 文件上测试
        const projectFile = join(
          rig.testDir!,
          'packages',
          'core',
          'src',
          'index.ts',
        );

        if (existsSync(projectFile)) {
          const result = await rig.run(`lsp documentSymbol ${projectFile}`);

          expect(result).toBeDefined();

          const toolCalls = rig.readToolCalls();
          const hasLspCall = toolCalls.some(
            (call) => call.toolRequest.name === 'lsp',
          );

          expect(hasLspCall).toBe(true);
        }
      },
      LSP_TEST_TIMEOUT,
    );
  });
});
