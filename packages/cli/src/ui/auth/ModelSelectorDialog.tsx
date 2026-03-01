/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { AuthType, type Config } from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { AuthState } from '../types.js';
import { debugLogger } from '@google/gemini-cli-core';
import { type LoadedSettings } from '../../config/settings.js';

interface ModelSelectorDialogProps {
  config: Config;
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  onAuthError: (error: string | null) => void;
}

export function ModelSelectorDialog({
  config,
  setAuthState,
  onAuthError,
}: ModelSelectorDialogProps): React.JSX.Element {
  const providerRegistry = config.getProviderRegistry();
  const allModels = providerRegistry.getAllModels();

  const modelItems = Array.from(allModels.entries()).map(
    ([modelId, modelData]) => ({
      label: `${modelId} - ${modelData.model.name || 'Custom Model'}`,
      value: modelId,
      key: modelId,
    }),
  );

  // Find the last selected model index, or default to 0
  const lastProviderModel = config.getLastProviderModel();
  const initialModelIndex = lastProviderModel
    ? modelItems.findIndex((item) => item.value === lastProviderModel)
    : 0;

  const [selectedModelIndex, setSelectedModelIndex] = useState(
    initialModelIndex >= 0 ? initialModelIndex : 0,
  );

  const handleSelection = useCallback(async () => {
    debugLogger.log('[ModelSelectorDialog] handleSelection called');
    debugLogger.log(
      '[ModelSelectorDialog] selectedModelIndex:',
      selectedModelIndex,
    );
    debugLogger.log('[ModelSelectorDialog] modelItems:', modelItems);
    debugLogger.log('[ModelSelectorDialog] config:', config);
    debugLogger.log(
      '[ModelSelectorDialog] config.getModel() before setModel:',
      config.getModel(),
    );

    const selectedModelId = modelItems[selectedModelIndex].value;

    try {
      debugLogger.log(
        '[ModelSelectorDialog] Setting model to:',
        selectedModelId,
      );
      debugLogger.log('[ModelSelectorDialog] About to call config.setModel');
      // Set the model in config
      config.setModel(selectedModelId, false);
      debugLogger.log(
        '[ModelSelectorDialog] Model after setModel:',
        config.getModel(),
      );
      debugLogger.log(
        '[ModelSelectorDialog] config.getLastProviderModel():',
        config.getLastProviderModel(),
      );

      // For CONFIG_LOGIN, we need to call refreshAuth to create the content generator
      debugLogger.log(
        '[ModelSelectorDialog] Calling refreshAuth to create content generator',
      );
      await config.refreshAuth(AuthType.CONFIG_LOGIN);
      debugLogger.log(
        '[ModelSelectorDialog] refreshAuth completed successfully',
      );

      setAuthState(AuthState.Authenticated);
      onAuthError(null);
    } catch (error) {
      debugLogger.error('[ModelSelectorDialog] Error:', error);
      onAuthError(
        error instanceof Error ? error.message : 'Failed to select model',
      );
      setAuthState(AuthState.Unauthenticated);
    }
  }, [selectedModelIndex, modelItems, config, setAuthState, onAuthError]);

  useKeypress(
    (pressedKey) => {
      debugLogger.log('[ModelSelectorDialog] keypress:', pressedKey);
      if ('return' in pressedKey && pressedKey.return) {
        debugLogger.log(
          '[ModelSelectorDialog] Enter pressed, calling handleSelection',
        );
        // Call handleSelection to proceed with the selected model
        void handleSelection();
      } else if ('down' in pressedKey && pressedKey.down) {
        setSelectedModelIndex((prev) =>
          prev < modelItems.length - 1 ? prev + 1 : prev,
        );
      } else if ('up' in pressedKey && pressedKey.up) {
        setSelectedModelIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    },
    { isActive: true },
  );

  // Early return after hooks - moved here to avoid rules-of-hooks violation
  if (modelItems.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={theme.status.error}>
          No models found in provider configuration.
        </Text>
        <Text color={theme.text.secondary}>
          Please configure providers in your settings.json file first.
        </Text>
        <Text color={theme.text.accent}>
          Press any key to return to auth selection...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.text.primary} bold>
        Select a Model (Config Login)
      </Text>
      <Text color={theme.text.secondary}>
        Choose a model from your configured providers:
      </Text>
      {lastProviderModel && initialModelIndex >= 0 && (
        <Text color={theme.text.accent} italic>
          Last selected model is pre-selected. Press Enter to use{' '}
          {lastProviderModel}.
        </Text>
      )}
      <Box marginTop={1}>
        <RadioButtonSelect
          items={modelItems}
          initialIndex={selectedModelIndex}
          onSelect={(value: (typeof modelItems)[number]['value']) => {
            debugLogger.log(
              '[ModelSelectorDialog] RadioButtonSelect onSelect called with value:',
              value,
            );
            // Find and set the index for the selected value
            const index = modelItems.findIndex((item) => item.value === value);
            if (index >= 0) {
              setSelectedModelIndex(index);
            }
            // Call handleSelection to proceed with the selected model
            void handleSelection();
          }}
          onHighlight={(value: (typeof modelItems)[number]['value']) => {
            debugLogger.log(
              '[ModelSelectorDialog] RadioButtonSelect onHighlight called with value:',
              value,
            );
            const index = modelItems.findIndex((item) => item.value === value);
            if (index >= 0) {
              setSelectedModelIndex(index);
            }
          }}
          isFocused={true}
          maxItemsToShow={10}
        />
      </Box>
      <Text color={theme.text.accent} italic>
        Press Enter to select this model and continue
      </Text>
    </Box>
  );
}
