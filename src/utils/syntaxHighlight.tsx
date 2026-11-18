import React from 'react';
import { FileLanguage } from '../types/ide';

/**
 * Lightweight VS Code Dark+ syntax highlighter returning React spans
 * that align 1:1 with a monospace <textarea> overlay.
 */
export function renderHighlightedCode(
  code: string,
  language: FileLanguage
): React.ReactNode {
  if (!code) return null;

  const lines = code.split('\n');
  return lines.map((line, lineIdx) => (
    <React.Fragment key={lineIdx}>
      {highlightLine(line, language)}
      {lineIdx < lines.length - 1 ? '\n' : null}
    </React.Fragment>
  ));
}

function highlightLine(line: string, language: FileLanguage): React.ReactNode {
  if (!line) return '';

  switch (language) {
    case 'html':
      return highlightHtmlLine(line);
    case 'json':
      return highlightJsonLine(line);
    case 'css':
      return highlightCssLine(line);
    case 'yaml':
      return highlightYamlLine(line);
    case 'markdown':
      return highlightMarkdownLine(line);
    case 'javascript':
    default:
      return highlightJsLine(line);
  }
}

function highlightHtmlLine(line: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex =
    /(<!--[\s\S]*?-->|<\/?[a-zA-Z!][a-zA-Z0-9-]*|\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?=\s*=)|\s*=\s*|"[^"]*"|'[^']*'|\/?>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const text = match[0];
    if (text.startsWith('<!--')) {
      tokens.push(
        <span key={key++} className="text-[#6a9955]">
          {text}
        </span>
      );
    } else if (text.startsWith('<')) {
      const prefix = text.startsWith('</') ? '</' : '<';
      const tagName = text.slice(prefix.length);
      tokens.push(
        <span key={key++} className="text-[#808080]">
          {prefix}
        </span>
      );
      tokens.push(
        <span key={key++} className="text-[#569cd6]">
          {tagName}
        </span>
      );
    } else if (text === '>' || text === '/>') {
      tokens.push(
        <span key={key++} className="text-[#808080]">
          {text}
        </span>
      );
    } else if (text.startsWith('"') || text.startsWith("'")) {
      tokens.push(
        <span key={key++} className="text-[#ce9178]">
          {text}
        </span>
      );
    } else if (text.includes('=')) {
      tokens.push(
        <span key={key++} className="text-[#d4d4d4]">
          {text}
        </span>
      );
    } else {
      tokens.push(
        <span key={key++} className="text-[#9cdcfe]">
          {text}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

function highlightJsonLine(line: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const text = match[0];
    if (text.startsWith('"')) {
      const isKey = line.slice(regex.lastIndex).trimStart().startsWith(':');
      tokens.push(
        <span key={key++} className={isKey ? 'text-[#9cdcfe]' : 'text-[#ce9178]'}>
          {text}
        </span>
      );
    } else if (text === 'true' || text === 'false' || text === 'null') {
      tokens.push(
        <span key={key++} className="text-[#569cd6]">
          {text}
        </span>
      );
    } else {
      tokens.push(
        <span key={key++} className="text-[#b5cea8]">
          {text}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

function highlightCssLine(line: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex =
    /(\/\*[\s\S]*?\*\/|@[a-zA-Z-]+|#[0-9a-fA-F]{3,8}\b|[a-zA-Z-]+(?=\s*:)|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|dvh|s|ms)?\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const text = match[0];
    if (text.startsWith('/*')) {
      tokens.push(
        <span key={key++} className="text-[#6a9955]">
          {text}
        </span>
      );
    } else if (text.startsWith('@')) {
      tokens.push(
        <span key={key++} className="text-[#c586c0]">
          {text}
        </span>
      );
    } else if (text.startsWith('"') || text.startsWith("'") || text.startsWith('#')) {
      tokens.push(
        <span key={key++} className="text-[#ce9178]">
          {text}
        </span>
      );
    } else if (/^\d/.test(text)) {
      tokens.push(
        <span key={key++} className="text-[#b5cea8]">
          {text}
        </span>
      );
    } else {
      tokens.push(
        <span key={key++} className="text-[#9cdcfe]">
          {text}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

function highlightYamlLine(line: string): React.ReactNode {
  const commentIdx = line.indexOf('#');
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

  const keyMatch = codePart.match(/^(\s*-?\s*)([a-zA-Z0-9_.-]+)(\s*:)(.*)$/);
  if (keyMatch) {
    return (
      <>
        {keyMatch[1]}
        <span className="text-[#9cdcfe]">{keyMatch[2]}</span>
        {keyMatch[3]}
        <span className="text-[#ce9178]">{keyMatch[4]}</span>
        {commentPart && <span className="text-[#6a9955]">{commentPart}</span>}
      </>
    );
  }

  return (
    <>
      {codePart}
      {commentPart && <span className="text-[#6a9955]">{commentPart}</span>}
    </>
  );
}

function highlightMarkdownLine(line: string): React.ReactNode {
  if (/^\s*#{1,6}\s/.test(line)) {
    return <span className="text-[#569cd6] font-bold">{line}</span>;
  }
  if (/^\s*[-*]\s/.test(line)) {
    return (
      <>
        <span className="text-[#569cd6]">{line.slice(0, 2)}</span>
        {line.slice(2)}
      </>
    );
  }
  return line;
}

const JS_CONTROL_KEYWORDS = new Set([
  'import',
  'export',
  'from',
  'default',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'await',
  'yield'
]);

const JS_DECL_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'async',
  'class',
  'extends',
  'new',
  'typeof',
  'instanceof',
  'true',
  'false',
  'null',
  'undefined',
  'this'
]);

function highlightJsLine(line: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+(?:\.\d+)?\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const text = match[0];
    if (text.startsWith('//') || text.startsWith('/*')) {
      tokens.push(
        <span key={key++} className="text-[#6a9955]">
          {text}
        </span>
      );
    } else if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) {
      tokens.push(
        <span key={key++} className="text-[#ce9178]">
          {text}
        </span>
      );
    } else if (/^\d/.test(text)) {
      tokens.push(
        <span key={key++} className="text-[#b5cea8]">
          {text}
        </span>
      );
    } else if (JS_CONTROL_KEYWORDS.has(text)) {
      tokens.push(
        <span key={key++} className="text-[#c586c0]">
          {text}
        </span>
      );
    } else if (JS_DECL_KEYWORDS.has(text)) {
      tokens.push(
        <span key={key++} className="text-[#569cd6]">
          {text}
        </span>
      );
    } else if (line[regex.lastIndex] === '(') {
      tokens.push(
        <span key={key++} className="text-[#dcdcaa]">
          {text}
        </span>
      );
    } else {
      tokens.push(text);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}
