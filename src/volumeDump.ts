import fs from 'fs-extra';
import { Pod, Volume, VolumeMount, Container } from 'kubernetes-types/core/v1';
import os from 'os';
import path from 'path';
import Dump, { DumpOptions } from './dump';
import kubectl from './kubectl';
import { mapSeries } from './helpers';
import { name } from '../package.json';
import { unpack } from './pack';

const prefix = `__${name}`;

export default class VolumeDump extends Dump {
  public options: VolumeDumpOptions;

  public workingPath = path.resolve(os.tmpdir(), 'kubedump/dump');

  constructor(options: Partial<VolumeDumpOptions> = {}) {
    super();
    this.options = {
      allNamespaces: false,
      dryrun: false,
      privileged: false,
      skipNamespaces: new Set(),
      ...options
    };
  }

  async dump(ns?: string) {
    if (!ns && !this.options.allNamespaces) {
      ns = this.options.ns || (await this.getActiveNs());
    }
    await mapSeries(
      Object.values(await this.getCpvmsByPvcName()),
      async (cpvms: Cpvm[]) => {
        await mapSeries(cpvms, async (cpvm: Cpvm) => {
          const { pod } = cpvm;
          if (
            (ns && pod.metadata?.namespace !== ns) ||
            this.options.skipNamespaces.has(pod.metadata?.namespace!)
          ) {
            return;
          }
          const namespacePath = path.resolve(
            this.workingPath,
            pod.metadata?.namespace || ''
          );
          const volumesPath = path.resolve(
            namespacePath,
            'volumes',
            pod.metadata?.name || ''
          );
          if (!this.options.dryrun) {
            await fs.remove(volumesPath);
            await fs.mkdirs(volumesPath);
          }
          await this.dumpData(cpvm, volumesPath);
        });
      }
    );
  }

  getSubpathsByVolumeName(
    relatedContainers: Container[],
    volumeName: string
  ): string[] {
    return [
      ...new Set(
        relatedContainers.reduce((subPaths: string[], container: Container) => {
          return [
            ...subPaths,
            ...(container.volumeMounts || []).reduce(
              (subPaths: string[], volumeMount: VolumeMount) => {
                if (volumeMount.name === volumeName && volumeMount.subPath) {
                  subPaths.push(volumeMount.subPath);
                }
                return subPaths;
              },
              []
            )
          ];
        }, [])
      )
    ];
  }

  async dumpData(
    { pod, volumeMount, volume, relatedContainers }: Cpvm,
    volumesPath: string
  ) {
    const backupScriptPath = path.resolve(__dirname, '../scripts/backup.sh');
    const { dryrun } = this.options;
    const { mountPath } = volumeMount;
    const volumeName = volume?.name;
    const subPaths = this.getSubpathsByVolumeName(
      relatedContainers,
      volume.name
    );
    if (!this.options.dryrun && subPaths.length) {
      await fs.mkdirp(path.resolve(volumesPath, volumeName, 'payload'));
    }
    await kubectl(
      [
        ...(this.options.privileged ? ['exec-as', '-u', 'root'] : ['exec']),
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"rm /tmp/${prefix}_backup.sh 2>/dev/null || true && rm -rf ${mountPath}/${prefix} 2>/dev/null || true"`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'cp',
        backupScriptPath,
        `${pod.metadata?.namespace}/${pod.metadata?.name}:/tmp/${prefix}_backup.sh`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        ...(this.options.privileged ? ['exec-as', '-u', 'root'] : ['exec']),
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"cd ${mountPath} && KUBEDUMP_DRYRUN=${dryrun} sh /tmp/${prefix}_backup.sh ${prefix} ${volumeName}${
          subPaths.length ? ` ${subPaths.join(',')}` : ''
        }"`
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        'cp',
        `${pod.metadata?.namespace}/${pod.metadata?.name}:${mountPath}/${prefix}/payload/payload.tar.gz`,
        subPaths.length
          ? path.resolve(volumesPath, volumeName, 'payload/payload.tar.gz')
          : path.resolve(volumesPath, `${volumeName}.tar.gz`)
      ],
      { dryrun, json: false, pipe: true }
    );
    await kubectl(
      [
        ...(this.options.privileged ? ['exec-as', '-u', 'root'] : ['exec']),
        '-n',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
        '--',
        'sh',
        '-c',
        `"rm /tmp/${prefix}_backup.sh 2>/dev/null || true && rm -rf ${mountPath}/${prefix} 2>/dev/null || true"`
      ],
      { dryrun, json: false, pipe: true }
    );
    if (dryrun) {
      process.stdout.write('\n');
    } else if (subPaths.length) {
      await unpack(
        path.resolve(volumesPath, volumeName, 'payload/payload.tar.gz'),
        path.resolve(volumesPath, volumeName)
      );
      await fs.remove(path.resolve(volumesPath, volumeName, 'payload'));
    }
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
                        container,
                        pod,
                        relatedContainers: [],
                        relatedPods: [],
                        relatedVolumeMounts: [],
                        relatedVolumes: [],
                        volume,
                        volumeMount
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
              const key = `${mountPath}:${name}${subPath ? `:${subPath}` : ''}`;
              cpvms[key] = {
                ...cpvm,
                relatedPods: [...(cpvms[key]?.relatedPods || []), cpvm.pod],
                relatedVolumes: [
                  ...(cpvms[key]?.relatedVolumes || []),
                  cpvm.volume
                ],
                relatedVolumeMounts: [
                  ...(cpvms[key]?.relatedVolumeMounts || []),
                  cpvm.volumeMount
                ],
                relatedContainers: [
                  ...(cpvms[key]?.relatedContainers || []),
                  cpvm.container
                ]
              };
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
}

export interface Cpvm {
  container: Container;
  pod: Pod;
  relatedContainers: Container[];
  relatedPods: Pod[];
  relatedVolumeMounts: VolumeMount[];
  relatedVolumes: Volume[];
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

export interface VolumeDumpOptions extends DumpOptions {
  dryrun: boolean;
  privileged: boolean;
}
