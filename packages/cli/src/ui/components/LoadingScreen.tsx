/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { CliSpinner } from './CliSpinner.js';
import { theme } from '../semantic-colors.js';

export interface InitializationStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  error?: string;
}

interface LoadingScreenProps {
  steps: InitializationStep[];
  title?: string;
  subtitle?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  steps,
  title = 'Initializing Gemini CLI...',
  subtitle,
}) => {
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = steps.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={10}
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          {title}
        </Text>
      </Box>

      {subtitle && (
        <Box marginBottom={2}>
          <Text color={theme.text.secondary}>{subtitle}</Text>
        </Box>
      )}

      <Box marginBottom={2}>
        <Text color={theme.text.secondary}>
          Progress: {completedCount}/{totalCount} ({progress}%)
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        {steps.map((step) => (
          <Box key={step.id} gap={1}>
            <Box width={3}>
              {step.status === 'pending' && <Text>  </Text>}
              {step.status === 'loading' && (
                <Text>
                  <CliSpinner />
                </Text>
              )}
              {step.status === 'completed' && (
                <Text color={theme.status.success}>✓</Text>
              )}
              {step.status === 'error' && (
                <Text color={theme.status.error}>✗</Text>
              )}
            </Box>
            <Box flexShrink={0}>
              <Text
                color={
                  step.status === 'error'
                    ? theme.status.error
                    : step.status === 'completed'
                      ? theme.text.primary
                      : theme.text.secondary
                }
              >
                {step.label}
              </Text>
            </Box>
            {step.status === 'loading' && (
              <Box marginLeft={1}>
                <CliSpinner />
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {steps.some((s) => s.status === 'error') && (
        <Box marginTop={2} flexDirection="column" gap={1}>
          <Text bold color={theme.status.error}>
            Errors encountered:
          </Text>
          {steps
            .filter((s) => s.status === 'error' && s.error)
            .map((s) => (
              <Text key={s.id} color={theme.text.secondary}>
                • {s.label}: {s.error}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
};
