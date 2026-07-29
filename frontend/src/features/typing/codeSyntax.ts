import type { CodeLanguage } from "./types";

export type CodeSyntaxKind =
  | "plain"
  | "keyword"
  | "type"
  | "literal"
  | "string"
  | "number"
  | "comment"
  | "punctuation";

const COMMON_KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "new",
  "return",
  "switch",
  "throw",
  "try",
  "var",
  "while",
]);

const LANGUAGE_KEYWORDS: Record<CodeLanguage, ReadonlySet<string>> = {
  cpp: new Set(["auto", "namespace", "public", "private", "static", "using"]),
  java: new Set([
    "boolean",
    "extends",
    "implements",
    "instanceof",
    "interface",
    "package",
    "private",
    "protected",
    "public",
    "static",
  ]),
  python3: new Set([
    "and",
    "as",
    "async",
    "await",
    "def",
    "elif",
    "except",
    "from",
    "global",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "with",
    "yield",
  ]),
  c: new Set(["enum", "extern", "register", "sizeof", "static", "struct"]),
  csharp: new Set([
    "as",
    "async",
    "await",
    "base",
    "internal",
    "is",
    "lock",
    "namespace",
    "override",
    "private",
    "protected",
    "public",
    "static",
    "using",
  ]),
  javascript: new Set([
    "async",
    "await",
    "delete",
    "export",
    "extends",
    "instanceof",
    "let",
    "of",
    "typeof",
  ]),
  typescript: new Set([
    "as",
    "async",
    "await",
    "declare",
    "export",
    "extends",
    "implements",
    "interface",
    "keyof",
    "let",
    "of",
    "readonly",
    "type",
    "typeof",
  ]),
  go: new Set([
    "chan",
    "defer",
    "fallthrough",
    "func",
    "go",
    "goto",
    "map",
    "package",
    "range",
    "select",
  ]),
};

const TYPE_WORDS = new Set([
  "Array",
  "ArrayDeque",
  "HashMap",
  "HashSet",
  "List",
  "Map",
  "Set",
  "String",
  "array",
  "bool",
  "boolean",
  "byte",
  "char",
  "double",
  "float",
  "int",
  "integer",
  "list",
  "long",
  "number",
  "object",
  "rune",
  "short",
  "size_t",
  "stack",
  "str",
  "string",
  "uint",
  "vector",
  "void",
]);

const LITERALS = new Set([
  "False",
  "None",
  "True",
  "false",
  "null",
  "nullptr",
  "true",
  "undefined",
]);

const IDENTIFIER_START = /[A-Za-z_]/u;
const IDENTIFIER_PART = /[A-Za-z0-9_]/u;
const DIGIT = /[0-9]/u;
const PUNCTUATION = /[()[\]{},.;:]/u;

function paint(
  kinds: CodeSyntaxKind[],
  start: number,
  end: number,
  kind: CodeSyntaxKind,
): void {
  for (let index = start; index < end; index += 1) {
    kinds[index] = kind;
  }
}

export function codeSyntaxKinds(
  line: string,
  language: CodeLanguage,
): readonly CodeSyntaxKind[] {
  const characters = Array.from(line);
  const kinds = characters.map<CodeSyntaxKind>(() => "plain");
  const lineComment = language === "python3" ? "#" : "//";
  const supportsTemplateStrings =
    language === "javascript" || language === "typescript";
  let index = 0;

  while (index < characters.length) {
    if (
      lineComment === "#" &&
      characters[index] === "#"
    ) {
      paint(kinds, index, characters.length, "comment");
      break;
    }
    if (
      lineComment === "//" &&
      characters[index] === "/" &&
      characters[index + 1] === "/"
    ) {
      paint(kinds, index, characters.length, "comment");
      break;
    }

    const character = characters[index] ?? "";
    const stringDelimiter =
      character === "'" ||
      character === '"' ||
      (supportsTemplateStrings && character === "`")
        ? character
        : null;
    if (stringDelimiter !== null) {
      const start = index;
      index += 1;
      let escaped = false;
      while (index < characters.length) {
        const current = characters[index] ?? "";
        index += 1;
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === stringDelimiter) {
          break;
        }
      }
      paint(kinds, start, index, "string");
      continue;
    }

    if (DIGIT.test(character)) {
      const start = index;
      index += 1;
      while (
        index < characters.length &&
        /[0-9A-Fa-f_xX.]/u.test(characters[index] ?? "")
      ) {
        index += 1;
      }
      paint(kinds, start, index, "number");
      continue;
    }

    if (IDENTIFIER_START.test(character)) {
      const start = index;
      index += 1;
      while (
        index < characters.length &&
        IDENTIFIER_PART.test(characters[index] ?? "")
      ) {
        index += 1;
      }
      const word = characters.slice(start, index).join("");
      const kind: CodeSyntaxKind =
        COMMON_KEYWORDS.has(word) || LANGUAGE_KEYWORDS[language].has(word)
          ? "keyword"
          : TYPE_WORDS.has(word) || /^[A-Z][A-Za-z0-9_]*$/u.test(word)
            ? "type"
            : LITERALS.has(word)
              ? "literal"
              : "plain";
      paint(kinds, start, index, kind);
      continue;
    }

    if (PUNCTUATION.test(character)) {
      kinds[index] = "punctuation";
    }
    index += 1;
  }

  return kinds;
}
