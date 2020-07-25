import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

export default abstract class VolumeDump {
  public abstract options: DumpOptions;

  public workingPath = path.resolve(os.tmpdir(), 'kubedump/dump');

  constructor() {}

  abstract async dump(_ns?: string): Promise<any>;

  async getActiveNs(): Promise<string> {
    const kubeconfigPath = path.resolve(os.homedir(), '.kube/config');
    const kubeconfig = yaml.safeLoad(
      (await fs.readFile(kubeconfigPath)).toString()
    ) as any;
    const kubectx = kubeconfig?.['current-context'];
    const context = (kubeconfig?.contexts || []).find(
      (context: any) => context.name === kubectx
    )?.context;
    return context.namespace;
  }
}

export interface DumpOptions {
  allNamespaces?: boolean;
  ns?: string;
  skipNamespaces: Set<string>;
}
