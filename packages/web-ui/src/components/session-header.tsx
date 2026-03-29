import { type Component } from 'solid-js';

interface SessionHeaderProps {
  sessionId: string | null;
  onBack: () => void;
}

export const SessionHeader: Component<SessionHeaderProps> = (props) => {
  return (
    <header class="session-header">
      <button onClick={props.onBack}>Back</button>
      <span>Session: {props.sessionId?.slice(0, 8) || 'New'}</span>
    </header>
  );
};
