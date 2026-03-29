import { type Component, createSignal } from 'solid-js';

interface PromptInputProps {
  onSend: (prompt: string) => void;
  disabled?: boolean;
}

export const PromptInput: Component<PromptInputProps> = (props) => {
  const [value, setValue] = createSignal('');

  const handleSend = () => {
    const trimmed = value().trim();
    if (trimmed && !props.disabled) {
      props.onSend(trimmed);
      setValue('');
    }
  };

  return (
    <div class="prompt-input">
      <textarea
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Type your message..."
        disabled={props.disabled}
      />
      <button onClick={handleSend} disabled={props.disabled}>
        Send
      </button>
    </div>
  );
};
