/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createSignal, Show } from 'solid-js';
import { useSettings } from '../context/settings.js';

const PROVIDER_TYPES = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'vertex', label: 'Vertex AI' },
  { value: 'simulated', label: 'Simulated' },
];

const SettingsDialog: Component = () => {
  const { settings, updateSettings, isSettingsOpen, closeSettings } =
    useSettings();
  const [urlValue, setUrlValue] = createSignal(settings().apiEndpoint);
  const [providerValue, setProviderValue] = createSignal(
    settings().providerType,
  );
  const [urlError, setUrlError] = createSignal('');

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      setUrlError('');
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  };

  const handleOpen = () => {
    setUrlValue(settings().apiEndpoint);
    setProviderValue(settings().providerType);
    setUrlError('');
  };

  const handleSave = () => {
    const trimmedUrl = urlValue().trim();
    if (!validateUrl(trimmedUrl)) return;
    updateSettings({
      apiEndpoint: trimmedUrl,
      providerType: providerValue(),
    });
    closeSettings();
  };

  const handleCancel = () => {
    closeSettings();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeSettings();
    }
  };

  return (
    <Show when={isSettingsOpen()}>
      <div
        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-gemini-msg-bg rounded-lg shadow-xl w-full max-w-lg mx-4 border border-gemini-dark-gray">
          <div className="px-4 py-3 border-b border-gemini-dark-gray">
            <h2 className="text-base font-semibold text-gemini-foreground">
              Settings
            </h2>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gemini-gray mb-1">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={urlValue()}
                onInput={(e) => {
                  setUrlValue(e.currentTarget.value);
                  if (urlError()) validateUrl(e.currentTarget.value);
                }}
                onBlur={() => validateUrl(urlValue())}
                placeholder="http://localhost:4097"
                className={`w-full px-3 py-2 bg-gemini-dark-gray border rounded text-gemini-foreground placeholder-gemini-comment focus:outline-none focus:ring-1 focus:ring-gemini-accent text-sm ${
                  urlError()
                    ? 'border-gemini-accent-red'
                    : 'border-gemini-dark-gray'
                }`}
              />
              <Show when={urlError()}>
                <p className="mt-1 text-xs text-gemini-accent-red">{urlError()}</p>
              </Show>
            </div>

            <div>
              <label className="block text-xs font-medium text-gemini-gray mb-1">
                Provider Type
              </label>
              <select
                value={providerValue()}
                onChange={(e) => setProviderValue(e.currentTarget.value)}
                className="w-full px-3 py-2 bg-gemini-dark-gray border border-gemini-dark-gray rounded text-gemini-foreground focus:outline-none focus:ring-1 focus:ring-gemini-accent text-sm"
              >
                {PROVIDER_TYPES.map((type) => (
                  <option value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gemini-dark-gray flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium text-gemini-gray hover:text-gemini-foreground hover:bg-gemini-dark-gray rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-medium bg-gemini-accent hover:bg-gemini-accent text-gemini-background rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export const SettingsButton: Component = () => {
  const { openSettings } = useSettings();

  return (
    <button
      onClick={openSettings}
      className="p-2 text-gemini-comment hover:text-gemini-foreground hover:bg-gemini-dark-gray rounded-md transition-colors"
      title="Settings"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
};

export default SettingsDialog;
