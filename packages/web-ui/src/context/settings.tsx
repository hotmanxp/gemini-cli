import {
  type ParentProps,
  createContext,
  useContext,
  createSignal,
  createEffect,
  onMount,
} from 'solid-js';

export interface Settings {
  apiEndpoint: string;
  providerType: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiEndpoint: 'http://localhost:4097',
  providerType: 'gemini',
};

const STORAGE_KEY = 'gemini-cli-settings';

interface SettingsContextValue {
  settings: () => Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
  isSettingsOpen: () => boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>();

function loadSettingsFromStorage(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return DEFAULT_SETTINGS;
}

function saveSettingsToStorage(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function SettingsProvider(props: ParentProps) {
  const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);

  onMount(() => {
    setSettings(loadSettingsFromStorage());
  });

  createEffect(() => {
    saveSettingsToStorage(settings());
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {props.children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
