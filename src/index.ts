import fs from 'fs-extra';
import { Pod, Volume, VolumeMount, Container } from 'kubernetes-types/core/v1';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import kubectl from './kubectl';
import { mapSeries } from './helpers';
import { name } from '../package.json';
import { unpack } from './pack';

const prefix = `__${name}`;
const workingPath = path.resolve(process.cwd(), 'backups');

export default class KubeDump {
  public options: KubeDumpOptions;

  constructor(options: Partial<KubeDumpOptions> = {}) {
    this.options = {
      dryrun: false,
      ...options
    };
  }

  async dump(ns?: string) {
    if (!ns) ns = this.options.ns || (await this.getActiveNs());
    await mapSeries(
      Object.values(await this.getCpvmsByPvcName()),
      async (cpvms: Cpvm[]) => {
        await mapSeries(cpvms, async (cpvm: Cpvm) => {
          const { pod, volume } = cpvm;
          if (ns && pod.metadata?.namespace !== ns) return;
          const backupPath = path.resolve(
            workingPath,
            pod.metadata?.namespace || '',
            pod.metadata?.name || '',
            'volumes',
            volume.name
          );
          await this.dumpData(cpvm, backupPath);
        });
      }
    );
  }

  async dumpData({ pod, volumeMount, volume }: Cpvm, backupPath: string) {
    const backupScriptPath = path.resolve(__dirname, '../scripts/backup.sh');
    const { dryrun } = this.options;
    const { mountPath } = volumeMount;
    const volumeName = volume?.name;
    await fs.remove(backupPath);
    await fs.mkdirs(backupPath);
    await kubectl(
      [
        'exec',
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"rm ${mountPath}/${prefix}_backup.sh 2>/dev/null || true && rm -rf ${mountPath}/${prefix} 2>/dev/null || true"`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'cp',
        backupScriptPath,
        `${pod.metadata?.namespace}/${pod.metadata?.name}:${mountPath}/${prefix}_backup.sh`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'exec',
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"cd ${mountPath} && KUBEDUMP_DRYRUN=${dryrun} sh ${mountPath}/${prefix}_backup.sh ${prefix} ${volumeName}"`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'cp',
        `${pod.metadata?.namespace}/${pod.metadata?.name}:${mountPath}/${prefix}/payload/payload.tar.gz`,
        path.resolve(backupPath, 'payload.tar.gz')
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'exec',
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"rm ${mountPath}/${prefix}_backup.sh 2>/dev/null || true && rm -rf ${mountPath}/${prefix} 2>/dev/null || true"`
      ],
      { dryrun, json: false, pipe: true }
    );
    await unpack(path.resolve(backupPath, 'payload.tar.gz'), backupPath);
    await fs.remove(path.resolve(backupPath, 'payload.tar.gz'));
    if (dryrun) process.stdout.write('\n');
  }

  async getCpvmsByPvcName(): Promise<CpvmsByPvcName> {
    return Object.entries(await this.getPvsByPvcName()).reduce(
      (
        cpvmsByPvcName: CpvmsByPvcName,
        [pvName, { pod, volume }]: [string, Pv]
      ) => {
        const cpvms = Object.values(
          (pod.spec?.containers || [])
            .reduce((cpvms: Cpvm[], container: Container) => {
              return [
                ...cpvms,
                ...(container.volumeMounts || []).reduce(
                  (cpvms: Cpvm[], volumeMount: VolumeMount) => {
                    if (volumeMount.name === volume?.name) {
                      cpvms.push({
                        volumeMount,
                        container,
                        pod,
                        volume
                      });
                    }
                    return cpvms;
                  },
                  []
                )
              ];
            }, [])
            .reduce((cpvms: CpvmsHashMap, cpvm: Cpvm) => {
              const { mountPath, name, subPath } = cpvm.volumeMount;
              cpvms[
                `${mountPath}:${name}${subPath ? `:${subPath}` : ''}`
              ] = cpvm;
              return cpvms;
            }, {})
        );
        const rootCpvm: any = cpvms.reduce(
          (rootCpvm: CpvmsHashMap, cpvm: Cpvm) => {
            const { volumeMount } = cpvm;
            if (!volumeMount.subPath) rootCpvm[volumeMount.name] = cpvm;
            return rootCpvm;
          },
          {}
        );
        cpvmsByPvcName[pvName] = cpvms.reduce((cpvms: Cpvm[], cpvm: Cpvm) => {
          const { volumeMount } = cpvm;
          if (rootCpvm[volumeMount.name]) {
            const nameSet = new Set(
              cpvms.map(({ volumeMount }: Cpvm) => volumeMount.name)
            );
            if (!nameSet.has(volumeMount.name)) {
              cpvms.push(rootCpvm[volumeMount.name]);
            }
          } else {
            cpvms.push(cpvm);
          }
          return cpvms;
        }, []);
        return cpvmsByPvcName;
      },
      {}
    );
  }

  async getPvsByPvcName(): Promise<PvsByPvcName> {
    return (await this.getPods()).reduce(
      (pvsByPvcName: PvsByPvcName, pod: Pod) => {
        (pod.spec?.volumes || []).map((volume: any) => {
          const claimName = volume?.persistentVolumeClaim?.claimName;
          if (claimName) pvsByPvcName[claimName] = { pod, volume };
        });
        return pvsByPvcName;
      },
      {}
    );
  }

  async getPods() {
    return (await kubectl(['get', 'pods', '--all-namespaces'])).items;
  }

  async getPvcs() {
    return (await kubectl(['get', 'pvc', '--all-namespaces'])).items;
  }

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

export interface Cpvm {
  container: Container;
  pod: Pod;
  volume: Volume;
  volumeMount: VolumeMount;
}

export interface Pv {
  pod: Pod;
  volume: Volume;
}

export interface CpvmsByPvcName {
  [pvcName: string]: Cpvm[];
}

export interface CpvmsHashMap {
  [key: string]: Cpvm;
}

export interface PvsByPvcName {
  [pvcName: string]: Pv;
}

export interface KubeDumpOptions {
  dryrun: boolean;
  ns?: string;
}
