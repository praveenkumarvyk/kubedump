import tar from 'tar';

export async function unpack(archivePath: string, cwd = process.cwd()) {
  await tar.x({
    file: archivePath,
    cwd
  });
}

export async function pack(folderPath: string, archivePath: string) {
  await tar.c(
    {
      cwd: folderPath,
      file: archivePath,
      gzip: true
    },
    ['.']
  );
}
