import execa from 'execa';

const logger = console;

export interface KubectlOptions {
  dryrun: boolean;
  json: boolean;
}

export default async function kubectl(
  args: string[],
  options: Partial<KubectlOptions> = {}
): Promise<any> {
  options = {
    json: true,
    dryrun: false,
    ...options
  };
  args = [...args, ...(options.json ? ['-o', 'json'] : [])];
  if (options.dryrun) {
    logger.info(`kubectl ${args.join(' ')}`);
  } else {
    const { stdout } = await execa('kubectl', args, { stdio: 'pipe' });
    return JSON.parse(stdout);
  }
}
