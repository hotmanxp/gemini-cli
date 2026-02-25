/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

interface UseModelCommandReturn {
  isModelDialogOpen: boolean;
  openModelDialog: () => void;
  closeModelDialog: () => void;
  isProviderModelDialogOpen: boolean;
  openProviderModelDialog: () => void;
  closeProviderModelDialog: () => void;
}

export const useModelCommand = (): UseModelCommandReturn => {
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isProviderModelDialogOpen, setIsProviderModelDialogOpen] = useState(false);

  const openModelDialog = useCallback(() => {
    setIsModelDialogOpen(true);
  }, []);

  const closeModelDialog = useCallback(() => {
    setIsModelDialogOpen(false);
  }, []);

  const openProviderModelDialog = useCallback(() => {
    setIsProviderModelDialogOpen(true);
  }, []);

  const closeProviderModelDialog = useCallback(() => {
    setIsProviderModelDialogOpen(false);
  }, []);

  return {
    isModelDialogOpen,
    openModelDialog,
    closeModelDialog,
    isProviderModelDialogOpen,
    openProviderModelDialog,
    closeProviderModelDialog,
  };
};
