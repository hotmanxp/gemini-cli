import { type Component, createMemo } from 'solid-js';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const markedInstance = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

markedInstance.setOptions({ gfm: true, breaks: true });

interface MarkdownProps {
  content: string;
}

export const Markdown: Component<MarkdownProps> = (props) => {
  const html = createMemo(() => {
    const content = props.content || '';
    if (!content.trim()) return '';
    return markedInstance.parse(content) as string;
  });

  return <div class="markdown" innerHTML={html()} />;
};
