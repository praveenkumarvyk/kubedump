import tar from 'tar';

export async function unpack(archivePath: string, cwd = process.cwd()) {
  tar.x({
    file: archivePath,
    cwd
  });
}

export async function pack() {}
