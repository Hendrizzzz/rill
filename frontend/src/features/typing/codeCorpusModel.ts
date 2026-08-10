export interface CodeTemplate {
  slug: string;
  title: string;
  topic: string;
  functionName: string;
  lesson?: string;
  assumptions?: string;
  complexity?: string;
  code: string;
}
