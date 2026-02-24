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
import type {
  LoadableSettingScope,
  LoadedSettings,
} from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';
import {
  AuthType,
  clearCachedCredentialFile,
  debugLogger,
  type Config,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { AuthState } from '../types.js';
import { runExitCleanup } from '../../utils/cleanup.js';
import { RELAUNCH_EXIT_CODE } from '../../utils/processUtils.js';
import { validateAuthMethodWithSettings } from './useAuth.js';
import { ModelSelectorDialog } from './ModelSelectorDialog.js';

interface UseAuthDialogProps {
  config: Config;
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  authError: string | null;
  onAuthError: (error: string | null) => void;
  setAuthContext: (context: { requiresRestart?: boolean }) => void;
}

export function UseAuthDialog({
  config,
  settings,
  setAuthState,
  authError,
  onAuthError,
  setAuthContext,
}: UseAuthDialogProps): React.JSX.Element {
  const [exiting, setExiting] = useState(false);
  
  // Initialize showModelSelector based on selectedType on startup
  // If CONFIG_LOGIN is already selected, show model selector immediately
  const [showModelSelector, setShowModelSelector] = useState(
    settings.merged.security.auth.selectedType === AuthType.CONFIG_LOGIN
  );
  
  debugLogger.log('[UseAuthDialog] initial showModelSelector:', showModelSelector);
  
  let items = [
    {
      label: 'Login with Google',
      value: AuthType.LOGIN_WITH_GOOGLE,
      key: AuthType.LOGIN_WITH_GOOGLE,
    },
    ...(process.env['CLOUD_SHELL'] === 'true'
      ? [
          {
            label: 'Use Cloud Shell user credentials',
            value: AuthType.COMPUTE_ADC,
            key: AuthType.COMPUTE_ADC,
          },
        ]
      : process.env['GEMINI_CLI_USE_COMPUTE_ADC'] === 'true'
        ? [
            {
              label: 'Use metadata server application default credentials',
              value: AuthType.COMPUTE_ADC,
              key: AuthType.COMPUTE_ADC,
            },
          ]
        : []),
    {
      label: 'Use Qwen OAuth (Read from ~/.qwen/oauth_creds.json)',
      value: AuthType.USE_QWEN,
      key: AuthType.USE_QWEN,
    },
    {
      label: 'Select Model from Config (Config Login)',
      value: AuthType.CONFIG_LOGIN,
      key: AuthType.CONFIG_LOGIN,
    },
    {
      label: 'Use Gemini API Key',
      value: AuthType.USE_GEMINI,
      key: AuthType.USE_GEMINI,
    },
    {
      label: 'Vertex AI',
      value: AuthType.USE_VERTEX_AI,
      key: AuthType.USE_VERTEX_AI,
    },
  ];

  if (settings.merged.security.auth.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security.auth.enforcedType,
    );
  }

  let defaultAuthType = null;
  const defaultAuthTypeEnv = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
  if (
    defaultAuthTypeEnv &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    Object.values(AuthType).includes(defaultAuthTypeEnv as AuthType)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    defaultAuthType = defaultAuthTypeEnv as AuthType;
  }

  let initialAuthIndex = items.findIndex((item) => {
    if (settings.merged.security.auth.selectedType) {
      return item.value === settings.merged.security.auth.selectedType;
    }

    if (defaultAuthType) {
      return item.value === defaultAuthType;
    }

    if (process.env['GEMINI_API_KEY']) {
      return item.value === AuthType.USE_GEMINI;
    }

    return item.value === AuthType.LOGIN_WITH_GOOGLE;
  });
  if (settings.merged.security.auth.enforcedType) {
    initialAuthIndex = 0;
  }

  const onSelect = useCallback(
    async (authType: AuthType | undefined, scope: LoadableSettingScope) => {
      debugLogger.log('[UseAuthDialog.onSelect] called with authType:', authType);
      if (exiting) {
        return;
      }
      if (authType) {
        if (authType === AuthType.LOGIN_WITH_GOOGLE) {
          setAuthContext({ requiresRestart: true });
        } else {
          setAuthContext({});
        }
        await clearCachedCredentialFile();

        settings.setValue(scope, 'security.auth.selectedType', authType);
        debugLogger.log('[UseAuthDialog.onSelect] settings setValue completed');
        if (
          authType === AuthType.LOGIN_WITH_GOOGLE &&
          config.isBrowserLaunchSuppressed()
        ) {
          setExiting(true);
          setTimeout(async () => {
            await runExitCleanup();
            process.exit(RELAUNCH_EXIT_CODE);
          }, 100);
          return;
        }

        if (authType === AuthType.USE_GEMINI) {
          if (process.env['GEMINI_API_KEY'] !== undefined) {
            setAuthState(AuthState.Unauthenticated);
            return;
          } else {
            setAuthState(AuthState.AwaitingApiKeyInput);
            return;
          }
        }
        
        if (authType === AuthType.CONFIG_LOGIN) {
          // Open model selector dialog for Config Login
          // Don't call refreshAuth yet - wait for user to select model
          debugLogger.log('[UseAuthDialog.onSelect] CONFIG_LOGIN - opening model selector');
          settings.setValue(scope, 'security.auth.selectedType', authType);
          setShowModelSelector(true);
          return;
        }
      }
      debugLogger.log('[UseAuthDialog.onSelect] Setting Unauthenticated');
      setAuthState(AuthState.Unauthenticated);
    },
    [settings, config, setAuthState, exiting, setAuthContext],
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    debugLogger.log('[UseAuthDialog.handleAuthSelect] START - authMethod:', authMethod);
    const error = validateAuthMethodWithSettings(authMethod, settings);
    debugLogger.log('[UseAuthDialog.handleAuthSelect] validation error:', error);
    if (error) {
      debugLogger.log('[UseAuthDialog.handleAuthSelect] returning with error');
      onAuthError(error);
    } else {
      // For CONFIG_LOGIN, still call onSelect to save selectedType and show model selector
      debugLogger.log('[UseAuthDialog.handleAuthSelect] Calling onSelect with:', authMethod);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onSelect(authMethod, SettingScope.User);
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (showModelSelector) {
          setShowModelSelector(false);
          return true;
        }
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (authError) {
          return true;
        }
        if (settings.merged.security.auth.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          onAuthError(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSelect(undefined, SettingScope.User);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  // Show model selector if Config Login was selected
  debugLogger.log('[UseAuthDialog] showModelSelector:', showModelSelector, 'rendering');
  if (showModelSelector) {
    debugLogger.log('[UseAuthDialog] Rendering ModelSelectorDialog');
    return (
      <ModelSelectorDialog
        config={config}
        settings={settings}
        setAuthState={setAuthState}
        onAuthError={onAuthError}
      />
    );
  }

  if (exiting) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.focused}
        flexDirection="row"
        padding={1}
        width="100%"
        alignItems="flex-start"
      >
        <Text color={theme.text.primary}>
          Logging in with Google... Restarting Gemini CLI to continue.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.focused}
      flexDirection="row"
      padding={1}
      width="100%"
      alignItems="flex-start"
    >
      <Text color={theme.text.accent}>? </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text bold color={theme.text.primary}>
          Get started
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            How would you like to authenticate for this project?
          </Text>
        </Box>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={items}
            initialIndex={initialAuthIndex}
            onSelect={handleAuthSelect}
            onHighlight={() => {
              onAuthError(null);
            }}
          />
        </Box>
        {authError && (
          <Box marginTop={1}>
            <Text color={theme.status.error}>{authError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Use Enter to select)</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            Terms of Services and Privacy Notice for Gemini CLI
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.link}>
            {
              'https://github.com/google-gemini/gemini-cli/blob/main/docs/tos-privacy.md'
            }
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
