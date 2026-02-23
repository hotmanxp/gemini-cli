/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP 功能集成测试 - 增强版
 *
 * 包含完整的工具调用结果验证
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

// ============================================
// 通用验证辅助函数
// ============================================

/**
 * 验证 LSP 返回结果包含有效的文件位置信息
 */
function assertValidLocation(result: string, expectedFileName: string): void {
  // 验证包含文件路径
  expect(result).toContain(expectedFileName);

  // 验证包含行号：列号格式 (:数字：数字)
  expect(result).toMatch(/:\d+:\d+/);

  // 验证包含语言标识
  expect(result.toLowerCase()).toContain('typescript');
}

/**
 * 验证 LSP 返回结果不包含错误信息
 */
function assertNoError(result: string): void {
  expect(result).not.toMatch(/not found|undefined|no.*found|error|failed/i);
}

/**
 * 验证 LSP 工具被调用
 */
async function assertLspToolCalled(rig: TestRig): Promise<void> {
  const foundToolCall = await rig.waitForToolCall('lsp');
  expect(foundToolCall, 'Expected LSP tool to be called').toBe(true);

  // 验证工具调用参数
  const toolLogs = rig.readToolLogs();
  const lspCall = toolLogs.find((log) => log.toolRequest.name === 'lsp');
  expect(lspCall).toBeDefined();
  expect(lspCall!.toolRequest.args).toBeDefined();
}

/**
 * 从结果中提取行号并验证范围
 */
function assertLineNumberInRange(
  result: string,
  fileName: string,
  minLine: number,
  maxLine: number,
): void {
  // Escape special regex characters in fileName
  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedFileName}:(\\d+):`);
  const lineMatch = result.match(regex);
  if (lineMatch) {
    const line = parseInt(lineMatch[1], 10);
    expect(line).toBeGreaterThanOrEqual(minLine);
    expect(line).toBeLessThanOrEqual(maxLine);
  }
}

// ============================================
// 测试用例
// ============================================

describe('LSP 集成测试 - 增强版', () => {
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

  // ============================================
  // goToDefinition 测试
  // ============================================

  describe('goToDefinition', () => {
    it(
      '应该能找到类定义并验证返回位置',
      async () => {
        // Setup fixtures
        await rig.setup('lsp-goToDefinition', {
          fakeResponsesPath: join(
            import.meta.dirname,
            'lsp-enhanced.responses',
          ),
        });
        createFixtures();

        // 运行 LSP 测试
        const result = await rig.run('找到 Calculator 类的定义位置');

        // ✅ 验证层级 1: 工具调用
        await assertLspToolCalled(rig);

        // ✅ 验证层级 2: 返回格式
        assertValidLocation(result, 'lsp-test.ts');

        // ✅ 验证层级 3: 内容正确性
        expect(result).toContain('Calculator');
        assertNoError(result);

        // ✅ 验证层级 4: 语义验证
        // Calculator 类定义在第 11 行附近
        assertLineNumberInRange(result, 'lsp-test.ts', 10, 15);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能找到函数定义并验证行号准确性',
      async () => {
        await rig.setup('lsp-findFunction');
        createFixtures();

        const result = await rig.run('找到 main 函数的定义位置');

        // 验证工具调用
        await assertLspToolCalled(rig);

        // 验证返回格式
        assertValidLocation(result, 'lsp-test.ts');

        // 验证内容正确性
        expect(result).toContain('main');
        assertNoError(result);

        // main 函数在第 52-58 行附近
        assertLineNumberInRange(result, 'lsp-test.ts', 50, 60);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能找到继承类的定义',
      async () => {
        await rig.setup('lsp-inheritedClass');
        createFixtures();

        const result = await rig.run('找到 ScientificCalculator 类的定义');

        await assertLspToolCalled(rig);
        assertValidLocation(result, 'lsp-test.ts');
        expect(result).toContain('ScientificCalculator');
        assertNoError(result);

        // ScientificCalculator 在第 30 行附近
        assertLineNumberInRange(result, 'lsp-test.ts', 28, 35);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // findReferences 测试
  // ============================================

  describe('findReferences', () => {
    it(
      '应该找到所有引用并验证数量',
      async () => {
        await rig.setup('lsp-findReferences');
        createFixtures();

        const result = await rig.run('找到 Calculator 类的所有引用');

        // 验证工具调用
        await assertLspToolCalled(rig);

        // 验证返回格式
        assertValidLocation(result, 'lsp-test.ts');

        // ✅ 验证引用数量
        // fixture 中 Calculator 至少有：
        // 1. 类定义 (行 11)
        // 2. 继承 (行 30)
        // 3. 实例化 (行 43)
        // 4. 实例化 (行 53)
        const referenceMatches = result.match(/Calculator/g) || [];
        expect(referenceMatches.length).toBeGreaterThanOrEqual(4);

        // 验证每个引用都包含位置信息
        const referenceLines = result
          .split('\n')
          .filter((line) => /^\d+\.\s+/.test(line.trim()));
        expect(referenceLines.length).toBeGreaterThanOrEqual(4);

        for (const line of referenceLines) {
          expect(line).toMatch(/\.ts:\d+:\d+/);
        }
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能找到函数的所有引用',
      async () => {
        await rig.setup('lsp-findFunctionRefs');
        createFixtures();

        const result = await rig.run('找到 calculateSum 函数的所有引用');

        await assertLspToolCalled(rig);
        assertValidLocation(result, 'lsp-test.ts');
        expect(result).toContain('calculateSum');
        assertNoError(result);

        // calculateSum 至少出现 2 次（定义 + 可能的调用）
        const referenceMatches = result.match(/calculateSum/g) || [];
        expect(referenceMatches.length).toBeGreaterThanOrEqual(2);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // hover 测试
  // ============================================

  describe('hover', () => {
    it(
      '应该显示准确的类型信息',
      async () => {
        await rig.setup('lsp-hover-type');
        createFixtures();

        const result = await rig.run('查看 getValue 函数的悬停信息');

        // 验证工具调用
        await assertLspToolCalled(rig);

        // ✅ 验证返回类型
        expect(result).toContain('number');
        expect(result).toMatch(/getValue.*:\s*number/i);

        // ✅ 验证函数签名
        expect(result).toMatch(/getValue\s*\(\s*\)/);

        // ✅ 验证不包含错误信息
        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该显示参数的类型信息',
      async () => {
        await rig.setup('lsp-hover-parameter');
        createFixtures();

        const result = await rig.run('查看 add 函数的参数类型');

        await assertLspToolCalled(rig);

        // add(n: number): void
        expect(result).toContain('n');
        expect(result).toContain('number');
        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该显示类的类型信息',
      async () => {
        await rig.setup('lsp-hover-class');
        createFixtures();

        const result = await rig.run('查看 Calculator 类的悬停信息');

        await assertLspToolCalled(rig);
        expect(result).toContain('Calculator');
        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // documentSymbol 测试
  // ============================================

  describe('documentSymbol', () => {
    it(
      '应该列出所有符号',
      async () => {
        await rig.setup('lsp-documentSymbol');
        createFixtures();

        const result = await rig.run('列出 lsp-test.ts 中的所有符号');

        // 验证工具调用
        await assertLspToolCalled(rig);

        // ✅ 验证包含所有主要符号
        expect(result).toContain('Calculator');
        expect(result).toContain('ScientificCalculator');
        expect(result).toContain('calculateSum');
        expect(result).toContain('main');

        // ✅ 验证符号类型标识
        expect(result).toMatch(/\[Class\]/);
        expect(result).toMatch(/\[Method\]/);
        expect(result).toMatch(/\[Function\]/);

        // ✅ 验证位置信息
        expect(result).toMatch(/\(\d+:\d+\)/);

        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该正确分类符号类型',
      async () => {
        await rig.setup('lsp-symbolTypes');
        createFixtures();

        const result = await rig.run('获取文档符号列表');

        await assertLspToolCalled(rig);

        // 验证包含不同类型的符号
        const hasClass = result.includes('[Class]') || result.includes('🅲');
        const hasMethod = result.includes('[Method]') || result.includes('🅼');
        const hasFunction =
          result.includes('[Function]') || result.includes('🅵');

        expect(hasClass).toBe(true);
        expect(hasMethod).toBe(true);
        expect(hasFunction).toBe(true);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // workspaceSymbol 测试
  // ============================================

  describe('workspaceSymbol', () => {
    it(
      '应该能在工作空间搜索符号',
      async () => {
        await rig.setup('lsp-workspaceSymbol');
        createFixtures();

        const result = await rig.run('搜索所有包含 Calculator 的符号');

        // 验证工具调用
        await assertLspToolCalled(rig);

        // ✅ 验证找到了符号
        expect(result).toContain('Calculator');

        // 验证返回了多个相关符号
        const calculatorMatches = result.match(/Calculator/g) || [];
        expect(calculatorMatches.length).toBeGreaterThanOrEqual(2);

        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能搜索函数符号',
      async () => {
        await rig.setup('lsp-searchFunction');
        createFixtures();

        const result = await rig.run('搜索 calculate 相关的函数');

        await assertLspToolCalled(rig);
        expect(result).toMatch(/calculate\w*/i);
        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // goToImplementation 测试
  // ============================================

  describe('goToImplementation', () => {
    it(
      '应该能找到实现',
      async () => {
        await rig.setup('lsp-goToImplementation');
        createFixtures();

        const result = await rig.run('找到 Calculator 的实现');

        await assertLspToolCalled(rig);

        // ScientificCalculator 继承自 Calculator
        expect(result).toContain('ScientificCalculator');
        assertNoError(result);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // diagnostics 测试
  // ============================================

  describe('diagnostics', () => {
    it(
      '应该能获取诊断信息',
      async () => {
        await rig.setup('lsp-diagnostics');
        createFixtures();

        const result = await rig.run('检查 lsp-test.ts 的错误和警告');

        await assertLspToolCalled(rig);

        // 正确的代码应该没有错误，或只返回"no errors"之类的信息
        expect(result).toBeDefined();
        // 不应该有崩溃或异常
        expect(result).not.toMatch(/崩溃 | 异常|crash|unhandled/i);
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能报告语法错误',
      async () => {
        await rig.setup('lsp-syntax-error');
        rig.createFile('broken.ts', 'class Broken { invalid syntax here }');

        const result = await rig.run('检查 broken.ts 的语法错误');

        await assertLspToolCalled(rig);

        // ✅ 验证报告了错误
        expect(result).toMatch(/错误|error|syntax|invalid/i);

        // ✅ 验证错误包含位置信息
        expect(result).toMatch(/:\d+:\d+/);
      },
      LSP_TEST_TIMEOUT,
    );
  });

  // ============================================
  // 综合场景测试
  // ============================================

  describe('LSP 综合场景', () => {
    it(
      '应该能在真实项目中工作',
      async () => {
        await rig.setup('lsp-integration');
        createFixtures();

        // 在一个真实的 TypeScript 文件上测试
        const projectFile = join(rig.testDir!, 'lsp-test.ts');

        if (existsSync(projectFile)) {
          const result = await rig.run(`获取 ${projectFile} 的符号列表`);

          await assertLspToolCalled(rig);
          expect(result).toBeDefined();
          expect(result).toContain('Calculator');
          assertNoError(result);
        }
      },
      LSP_TEST_TIMEOUT,
    );

    it(
      '应该能处理连续多次 LSP 调用',
      async () => {
        await rig.setup('lsp-multiple-calls');
        createFixtures();

        // 第一次调用：获取定义
        const result1 = await rig.run('找到 Calculator 类的定义');
        await assertLspToolCalled(rig);
        assertValidLocation(result1, 'lsp-test.ts');

        // 第二次调用：获取引用
        const result2 = await rig.run('找到 Calculator 的所有引用');
        const toolLogs = rig.readToolLogs();
        const lspCalls = toolLogs.filter(
          (log) => log.toolRequest.name === 'lsp',
        );
        expect(lspCalls.length).toBeGreaterThanOrEqual(2);

        assertValidLocation(result2, 'lsp-test.ts');
        const referenceMatches = result2.match(/Calculator/g) || [];
        expect(referenceMatches.length).toBeGreaterThanOrEqual(4);
      },
      LSP_TEST_TIMEOUT,
    );
  });
});
