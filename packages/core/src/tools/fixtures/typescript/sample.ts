/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sample TypeScript file for LSP integration tests.
 * This file contains various code constructs to test LSP operations.
 */

// A simple class for testing goToDefinition and references
export class Calculator {
  private value: number = 0;

  constructor(initialValue?: number) {
    this.value = initialValue ?? 0;
  }

  add(n: number): void {
    this.value += n;
  }

  subtract(n: number): void {
    this.value -= n;
  }

  multiply(n: number): void {
    this.value *= n;
  }

  divide(n: number): number {
    if (n === 0) {
      throw new Error('Division by zero');
    }
    return this.value / n;
  }

  getValue(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
  }
}

// A class that extends Calculator for testing implementation and inheritance
export class ScientificCalculator extends Calculator {
  private memory: number = 0;

  storeMemory(): void {
    this.memory = this.getValue();
  }

  recallMemory(): number {
    return this.memory;
  }

  clearMemory(): void {
    this.memory = 0;
  }

  // Override parent method
  override reset(): void {
    super.reset();
    this.clearMemory();
  }

  // Abstract-like method for testing implementations
  computeSquareRoot(): number {
    return Math.sqrt(this.getValue());
  }
}

// Another implementation of Calculator pattern
export class AdvancedCalculator extends Calculator {
  private history: string[] = [];

  private logOperation(operation: string): void {
    this.history.push(operation);
  }

  override add(n: number): void {
    super.add(n);
    this.logOperation(`add ${n}`);
  }

  override subtract(n: number): void {
    super.subtract(n);
    this.logOperation(`subtract ${n}`);
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

// Interface for testing implementation lookup
export interface Computable {
  compute(): number;
  reset(): void;
}

// A function that uses Calculator
export function calculateSum(numbers: number[], initial?: number): number {
  const calc = new Calculator(initial);
  for (const num of numbers) {
    calc.add(num);
  }
  return calc.getValue();
}

// Another function for testing references
export function calculateProduct(numbers: number[], initial?: number): number {
  const calc = new Calculator(initial ?? 1);
  for (const num of numbers) {
    calc.multiply(num);
  }
  return calc.getValue();
}

// Main function demonstrating usage
export function main(): void {
  const calc = new Calculator(10);
  calc.add(5);
  calc.multiply(2);

  // Use ScientificCalculator
  const sciCalc = new ScientificCalculator(100);
  sciCalc.add(50);
  sciCalc.storeMemory();

  // Use AdvancedCalculator
  const advCalc = new AdvancedCalculator(200);
  advCalc.add(100);
}

// Test helper function
function runTests(): void {
  const testCalc = new Calculator();
  testCalc.add(1);
}

// Run main if executed directly
if (require.main === module) {
  main();
  runTests();
}
