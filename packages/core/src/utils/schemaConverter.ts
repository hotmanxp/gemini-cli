/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Schema compliance mode for controlling how strictly schemas are enforced
 */
export type SchemaComplianceMode = 'auto' | 'strict' | 'relaxed';

/**
 * Converts a schema to the target format based on compliance mode
 * @param schema - The schema to convert
 * @param mode - The compliance mode
 * @returns The converted schema
 */
export function convertSchema(
  schema: Record<string, unknown> | undefined,
  mode: SchemaComplianceMode = 'auto',
): Record<string, unknown> | undefined {
  if (!schema) {
    return undefined;
  }

  // Deep clone the schema to avoid mutating the original
  const converted = JSON.parse(JSON.stringify(schema));

  if (mode === 'auto' || mode === 'strict') {
    // Convert types to JSON Schema format
    convertTypes(converted);
  }

  return converted as Record<string, unknown>;
}

/**
 * Recursively converts type values in a schema object
 */
function convertTypes(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertTypes);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'type' && typeof value === 'string') {
      // Convert to lowercase for consistency
      result[key] = value.toLowerCase();
    } else if (
      key === 'minimum' ||
      key === 'maximum' ||
      key === 'multipleOf'
    ) {
      // Ensure numeric constraints are actual numbers, not strings
      if (typeof value === 'string' && !isNaN(Number(value))) {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    } else if (
      key === 'minLength' ||
      key === 'maxLength' ||
      key === 'minItems' ||
      key === 'maxItems'
    ) {
      // Ensure length constraints are integers, not strings
      if (typeof value === 'string' && !isNaN(Number(value))) {
        result[key] = parseInt(value, 10);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object') {
      result[key] = convertTypes(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
