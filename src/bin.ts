import { config } from 'dotenv';
import { parse, flags } from '@oclif/parser';
import KubeDump from '.';

config();
const { RANCHER_TOKEN, RANCHER_ENDPOINT, RANCHER_CLUSTER } = process.env;

export default async function main(argv: string[]) {
  const result = parse(argv, {
    strict: false,
    flags: {
      'all-namespaces': flags.boolean({ required: false }),
      'rancher-cluster': flags.string({ required: false }),
      'rancher-dump': flags.boolean({ required: false }),
      'rancher-endpoint': flags.string({ required: false }),
      'rancher-token': flags.string({ required: false }),
      'skip-namespaces': flags.string({ required: false }),
      'volume-dump': flags.boolean({ required: false }),
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
    rancherCluster: result.flags['rancher-cluster'] || RANCHER_CLUSTER,
    rancherDump: result.flags['rancher-dump'],
    rancherEndpoint: result.flags['rancher-endpoint'] || RANCHER_ENDPOINT,
    rancherToken: result.flags['rancher-token'] || RANCHER_TOKEN,
    skipNamespaces: new Set((result.flags['skip-namespaces'] || '').split(',')),
    volumeDump: result.flags['volume-dump']
  });
  await kubeDump.dump();
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv).catch(console.error);
}
