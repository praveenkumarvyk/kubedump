import { parse, flags } from '@oclif/parser';
import KubeDump from '.';

const logger = console;

export default async function main(argv: string[]) {
  const result = parse(argv, {
    strict: false,
    flags: {
      namespace: flags.string({ char: 'n', required: false }),
      dry: flags.boolean({ required: false })
    }
  });
  const kubeDump = new KubeDump({
    ns: result.flags.namespace,
    dryrun: result.flags.dry
  });
  await kubeDump.dump();
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv).catch(logger.error);
}
