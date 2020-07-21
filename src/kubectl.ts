import execa from 'execa';

export default async function kubectl(...args: string[]): Promise<any> {
  const { stdout } = await execa('kubectl', [...args, '-o', 'json'], {
    stdio: 'pipe'
  });
  return JSON.parse(stdout);
}
