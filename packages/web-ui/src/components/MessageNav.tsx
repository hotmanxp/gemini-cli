/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, For } from 'solid-js';
import type { SessionMessage } from '../lib/sdk-shim.js';

interface MessageNavProps {
  messages: SessionMessage[];
  currentIndex: number;
  onMessageSelect: (index: number) => void;
}

export const MessageNav: Component<MessageNavProps> = (props) => {
  const userMessageIndices = () => {
    const indices: number[] = [];
    props.messages.forEach((msg, i) => {
      if (msg.role === 'user') {
        indices.push(i);
      }
    });
    return indices;
  };

  const getMessagePreview = (msg: SessionMessage) => {
    const textPart = msg.parts.find((p) => p.type === 'text');
    if (textPart && 'text' in textPart) {
      const text = textPart.text;
      return text.length > 30 ? text.slice(0, 30) + '...' : text;
    }
    return 'Message';
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-gemini-msg-bg">
      <span className="text-xs text-gemini-comment font-medium">Msgs:</span>
      <div className="flex gap-1">
        <For each={userMessageIndices()}>
          {(msgIndex, navIndex) => (
            <button
              onClick={() => props.onMessageSelect(msgIndex)}
              className={`
                flex items-center justify-center
                w-6 h-6 rounded text-xs font-mono
                transition-colors
                ${
                  msgIndex === props.currentIndex
                    ? 'bg-gemini-accent text-gemini-background'
                    : 'bg-gemini-dark-gray text-gemini-comment hover:bg-gemini-dark-gray hover:text-gemini-foreground'
                }
              `}
              title={getMessagePreview(props.messages[msgIndex])}
            >
              {navIndex() + 1}
            </button>
          )}
        </For>
      </div>
    </div>
  );
};
