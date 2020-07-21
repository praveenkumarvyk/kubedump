import KubeDump from '.';

export default async function main(_argv: string[]) {
  const kubeDump = new KubeDump();
  await kubeDump.dump();
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv);
}
