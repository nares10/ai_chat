"use client";

import MarkdownIt from "markdown-it";
import DOMPurify from "isomorphic-dompurify";

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

interface MarkdownMessageProps {
  text: string;
}

export default function MarkdownMessage({
  text,
}: MarkdownMessageProps) {
  const html = md.render(text);
  const safeHtml = DOMPurify.sanitize(html);

  return (
    <div
      className="prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}