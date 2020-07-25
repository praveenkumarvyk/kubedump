import { parse, flags } from '@oclif/parser';
import KubeDump from '.';

export default async function main(argv: string[]) {
  const result = parse(argv, {
    strict: false,
    flags: {
      'all-namespaces': flags.boolean({ required: false }),
      'skip-namespaces': flags.string({ required: false }),
      dry: flags.boolean({ required: false }),
      namespace: flags.string({ char: 'n', required: false }),
      output: flags.string({ char: 'o', required: false }),
      privileged: flags.boolean({ char: 'p', required: false })
    }
  });
  const kubeDump = new KubeDump({
    allNamespaces: result.flags['all-namespaces'],
    dryrun: result.flags.dry,
    ns: result.flags.namespace,
    output: result.flags.output,
    privileged: result.flags.privileged,
    skipNamespaces: new Set((result.flags['skip-namespaces'] || '').split(','))
  });
  await kubeDump.dump();
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv).catch(console.error);
}
