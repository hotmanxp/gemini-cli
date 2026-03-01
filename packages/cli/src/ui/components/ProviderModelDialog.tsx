/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  ModelSlashCommandEvent,
  logModelSlashCommand,
  AuthType,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import { saveModelChange } from '../../config/settings.js';

interface ProviderModelDialogProps {
  onClose: () => void;
}

export function ProviderModelDialog({
  onClose,
}: ProviderModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext)!;
  const loadedSettings = useContext(SettingsContext);
  const [persistMode, setPersistMode] = useState(false);

  const providerRegistry = config.getProviderRegistry();
  const allModels = useMemo(
    () => providerRegistry?.getAllModels() || new Map(),
    [providerRegistry],
  );

  const modelItems = useMemo(() => {
    const items = Array.from(allModels.entries()).map(
      ([modelId, modelData]) => ({
        value: modelId,
        title: `${modelId} - ${modelData.model.name || 'Custom Model'}`,
        description: modelData.model.description || modelData.model.name,
        key: modelId,
      }),
    );
    return items;
  }, [allModels]);

  const lastProviderModel = config.getLastProviderModel();
  const initialIndex = useMemo(() => {
    if (!lastProviderModel) return 0;
    const idx = modelItems.findIndex(
      (item) => item.value === lastProviderModel,
    );
    return idx >= 0 ? idx : 0;
  }, [lastProviderModel, modelItems]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
        return true;
      }
      if (key.name === 'tab') {
        setPersistMode((prev) => !prev);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  const handleSelect = useCallback(
    async (model: string) => {
      const currentModel = config.getModel();
      const [newProvider] = model.split('/');
      const [currentProvider] = currentModel.split('/');

      // Respect persistMode toggle: only save when persistMode is true
      const isTemporary = !persistMode;

      config.setModel(model, isTemporary);

      // Manually call saveModelChange when persistMode is true to ensure settings.json is updated
      if (persistMode && loadedSettings) {
        saveModelChange(loadedSettings, model);
      }

      const event = new ModelSlashCommandEvent(model);
      logModelSlashCommand(config, event);

      // Always refresh auth when model is selected to ensure content generator is initialized
      // Switch provider if different, or just switch model if same provider
      if (newProvider !== currentProvider) {
        await config.refreshAuth(AuthType.CONFIG_LOGIN);
      } else {
        // Same provider, just switch model using the content generator's switchModel
        const contentGenerator = config.getContentGenerator();
        if (contentGenerator && 'switchModel' in contentGenerator) {
          // switchModel expects just the modelId without provider prefix
          const modelId = model.includes('/') ? model.split('/')[1] : model;

          // eslint-disable-next-line
          await (contentGenerator as any).switchModel(modelId);
        } else {
          // If switchModel not available, refresh auth to recreate content generator
          await config.refreshAuth(AuthType.CONFIG_LOGIN);
        }
      }
      onClose();
    },
    [config, onClose, persistMode, loadedSettings],
  );

  if (!config) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={theme.status.error}>
          Error: Config not available
        </Text>
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    );
  }

  if (modelItems.length === 0) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={theme.status.error}>
          No Provider Models Available
        </Text>
        <Box marginTop={1} flexDirection="column" gap={1}>
          <Text color={theme.text.primary}>
            No models found in provider configuration.
          </Text>
          <Text color={theme.text.secondary}>
            Please configure providers in your settings.json file first.
          </Text>
          <Text color={theme.text.accent}>(Press Esc to close)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Provider Model</Text>

      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={modelItems}
          onSelect={async (value: string) => {
            await handleSelect(value);
          }}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.text.primary}>
            Remember model for future sessions:{' '}
          </Text>
          <Text color={theme.status.success}>
            {persistMode ? 'true' : 'false'}
          </Text>
        </Box>
        <Text color={theme.text.secondary}>(Press Tab to toggle)</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
