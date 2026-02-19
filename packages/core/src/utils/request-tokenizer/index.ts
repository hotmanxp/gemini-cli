/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CountTokensParameters } from '@google/genai';

/**
 * Result of token estimation
 */
export interface TokenEstimationResult {
  totalTokens: number;
}

/**
 * RequestTokenEstimator - Estimates token count for requests using character-based approximation
 *
 * This is a lightweight tokenizer that provides quick estimates without requiring
 * external tokenization libraries. It uses a character-based approximation where
 * 1 token ≈ 4 characters on average.
 */
export class RequestTokenEstimator {
  /**
   * Calculate estimated token count for a request
   * @param request - The request containing content to tokenize
   * @returns Token estimation result
   */
  async calculateTokens(
    request: CountTokensParameters,
  ): Promise<TokenEstimationResult> {
    const content = this.extractContentFromRequest(request);
    const totalTokens = Math.ceil(content.length / 4);

    return {
      totalTokens,
    };
  }

  /**
   * Extract text content from request for tokenization
   */
  private extractContentFromRequest(request: CountTokensParameters): string {
    if (!request.contents) {
      return '';
    }

    if (Array.isArray(request.contents)) {
      return request.contents
        .map((content) => this.extractTextFromContent(content))
        .join(' ');
    }

    return this.extractTextFromContent(request.contents);
  }

  /**
   * Extract text from a single content item
   */
  private extractTextFromContent(
    content: unknown,
  ): string {
    if (typeof content === 'string') {
      return content;
    }

    if (content && typeof content === 'object' && 'parts' in content) {
      const contentObj = content as { parts?: unknown[] };
      if (Array.isArray(contentObj.parts)) {
        return contentObj.parts
          .map((part) => this.extractTextFromPart(part))
          .join(' ');
      }
    }

    return '';
  }

  /**
   * Extract text from a part
   */
  private extractTextFromPart(part: unknown): string {
    if (typeof part === 'string') {
      return part;
    }

    if (part && typeof part === 'object' && 'text' in part) {
      const partObj = part as { text?: string };
      return partObj.text || '';
    }

    return '';
  }
}
