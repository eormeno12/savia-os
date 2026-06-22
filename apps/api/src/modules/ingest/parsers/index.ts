// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseFile(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const result = await pdfParse(buffer);
      return result.text;
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
    case 'application/json':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported mimeType: ${mimeType}`);
  }
}
