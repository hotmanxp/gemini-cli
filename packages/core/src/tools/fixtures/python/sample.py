# encoding: utf-8
# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Sample Python file for LSP integration tests.
This file contains various code constructs to test LSP operations.
"""

from typing import List, Optional


class Calculator:
    """A simple calculator class for testing LSP operations."""

    def __init__(self, initial_value: int = 0) -> None:
        self._value = initial_value

    def add(self, n: int) -> None:
        """Add a number to the current value."""
        self._value += n

    def subtract(self, n: int) -> None:
        """Subtract a number from the current value."""
        self._value -= n

    def multiply(self, n: int) -> None:
        """Multiply the current value by a number."""
        self._value *= n

    def divide(self, n: int) -> float:
        """Divide the current value by a number."""
        if n == 0:
            raise ValueError("Division by zero")
        return self._value / n

    def get_value(self) -> int:
        """Get the current value."""
        return self._value

    def reset(self) -> None:
        """Reset the calculator to zero."""
        self._value = 0


class ScientificCalculator(Calculator):
    """An advanced calculator with memory functionality."""

    def __init__(self, initial_value: int = 0) -> None:
        super().__init__(initial_value)
        self._memory = 0

    def store_memory(self) -> None:
        """Store current value in memory."""
        self._memory = self.get_value()

    def recall_memory(self) -> int:
        """Recall value from memory."""
        return self._memory

    def clear_memory(self) -> None:
        """Clear the memory."""
        self._memory = 0

    # Override parent method
    def reset(self) -> None:
        """Reset calculator and memory."""
        super().reset()
        self.clear_memory()

    def compute_square_root(self) -> float:
        """Compute square root of current value."""
        import math
        return math.sqrt(self.get_value())


class AdvancedCalculator(Calculator):
    """A calculator with operation history."""

    def __init__(self, initial_value: int = 0) -> None:
        super().__init__(initial_value)
        self._history: List[str] = []

    def _log_operation(self, operation: str) -> None:
        """Log an operation to history."""
        self._history.append(operation)

    def add(self, n: int) -> None:
        """Add and log the operation."""
        super().add(n)
        self._log_operation(f"add {n}")

    def subtract(self, n: int) -> None:
        """Subtract and log the operation."""
        super().subtract(n)
        self._log_operation(f"subtract {n}")

    def get_history(self) -> List[str]:
        """Get the operation history."""
        return self._history.copy()


def calculate_sum(numbers: List[int], initial: int = 0) -> int:
    """Calculate the sum of a list of numbers."""
    calc = Calculator(initial)
    for num in numbers:
        calc.add(num)
    return calc.get_value()


def calculate_product(numbers: List[int], initial: int = 1) -> int:
    """Calculate the product of a list of numbers."""
    calc = Calculator(initial)
    for num in numbers:
        calc.multiply(num)
    return calc.get_value()


def main() -> None:
    """Main function demonstrating calculator usage."""
    calc = Calculator(10)
    calc.add(5)
    calc.multiply(2)

    result = calc.get_value()
    print(f"Result: {result}")

    # Use ScientificCalculator
    sci_calc = ScientificCalculator(100)
    sci_calc.add(50)
    sci_calc.store_memory()

    # Use AdvancedCalculator
    adv_calc = AdvancedCalculator(200)
    adv_calc.add(100)
    print(adv_calc.get_history())


def run_tests() -> None:
    """Run basic tests."""
    test_calc = Calculator()
    test_calc.add(1)
    assert test_calc.get_value() == 1, "Test failed"


if __name__ == "__main__":
    main()
    run_tests()
