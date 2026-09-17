// modules/generator/zip.ts
// Zip packaging helper using archiver (§7.8)

import archiver from 'archiver';
import { Readable } from 'stream';

export interface GeneratedFileTree {
  [path: string]: string;
}

export function createZipStream(fileTree: GeneratedFileTree): Readable {
  const archive = archiver('zip', { zlib: { level: 9 } });

  for (const [filePath, content] of Object.entries(fileTree)) {
    archive.append(content, { name: filePath });
  }

  archive.finalize();
  return archive as unknown as Readable;
}
