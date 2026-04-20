/**
 * Split markdown into chunks by H2 (`## `) headings.
 * Content before the first H2 is discarded. Each chunk includes the heading line
 * and everything (including any `###`+ subsections) until the next H2.
 */
export function chunkMarkdownByH2(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^##(?!#)\s+/.test(line)) {
      if (current) sections.push(current.join("\n"));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) sections.push(current.join("\n"));

  return sections;
}
