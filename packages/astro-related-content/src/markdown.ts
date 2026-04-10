import { toString } from "mdast-util-to-string";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

type MarkdownNode = {
  alt?: string;
  children?: MarkdownNode[];
  type?: string;
  value?: string;
};

const markdownProcessor = unified().use(remarkParse).use(remarkMdx);
const ignoredNodeTypes = new Set([
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
  "yaml",
]);

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

function fallbackMarkdownToPlainText(markdown: string): string {
  return normalizePlainText(
    markdown
      .replace(/^import\s.+$/gm, " ")
      .replace(/^export\s.+$/gm, " ")
      .replace(/<[^>]*>/gs, " ")
      .replace(/\{[^}]*\}/gs, " "),
  );
}

function extractNodeText(node: MarkdownNode | undefined): string {
  if (!node || (node.type && ignoredNodeTypes.has(node.type))) {
    return "";
  }

  if (node.type === "html") {
    return stripHtml(node.value ?? "");
  }

  if (typeof node.value === "string" && !String(node.type).startsWith("mdxJsx")) {
    return node.value;
  }

  if (typeof node.alt === "string" && node.alt.length > 0) {
    return node.alt;
  }

  if (Array.isArray(node.children)) {
    return node.children.map(extractNodeText).join(" ");
  }

  return toString(node);
}

export function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function markdownToPlainText(markdown: string): string {
  try {
    const tree = markdownProcessor.parse(markdown) as MarkdownNode;
    return normalizePlainText(extractNodeText(tree));
  } catch {
    return fallbackMarkdownToPlainText(markdown);
  }
}
