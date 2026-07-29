import type { ContentType } from "./types";

export const CODE_INDENT_WIDTH = 4;

export function leadingCodeIndentation(value: string): number {
  let indentation = 0;
  while (value[indentation] === " ") {
    indentation += 1;
  }
  return indentation;
}

export function typableTarget(
  value: string,
  contentType: ContentType,
): string {
  return contentType === "code"
    ? value.slice(leadingCodeIndentation(value))
    : value;
}
