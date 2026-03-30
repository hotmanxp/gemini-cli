/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  type ParentProps,
  createContext,
  useContext,
  createMemo,
} from 'solid-js';
import { GeminiWebClient, type SessionEvent } from '../lib/sdk-shim.js';
import { useSettings } from './settings.js';

interface SdkContextValue {
  client: () => GeminiWebClient;
  subscribe: (handler: (event: SessionEvent) => void) => () => void;
}

const SdkContext = createContext<SdkContextValue>();

export function SdkProvider(props: ParentProps) {
  const { settings } = useSettings();
  const client = createMemo(() => new GeminiWebClient(settings().apiEndpoint));

  const subscribe = (handler: (event: SessionEvent) => void) => client().subscribe(handler);

  return (
    <SdkContext.Provider value={{ client, subscribe }}>
      {props.children}
    </SdkContext.Provider>
  );
}

export function useSdk() {
  const ctx = useContext(SdkContext);
  if (!ctx) throw new Error('useSdk must be used within SdkProvider');
  return ctx;
}
