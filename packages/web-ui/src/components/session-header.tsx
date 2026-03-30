/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component } from 'solid-js';

interface SessionHeaderProps {
  sessionId: string | null;
  onBack: () => void;
}

export const SessionHeader: Component<SessionHeaderProps> = (props) => (
    <header className="session-header">
      <button onClick={props.onBack}>Back</button>
      <span>Session: {props.sessionId?.slice(0, 8) || 'New'}</span>
    </header>
  );
