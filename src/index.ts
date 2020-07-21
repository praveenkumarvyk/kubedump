import fs from 'fs-extra';
import path from 'path';
import kubectl from './kubectl';
import { mapSeries } from './helpers';
import { name } from '../package.json';

const dryrun = true;
const logger = console;
const prefix = `__${name}`;
const workingPath = path.resolve(process.cwd(), 'backups');

export default class KubeDump {
  async dump() {
    const backupScriptPath = path.resolve(__dirname, '../scripts/backup.sh');
    await mapSeries(
      Object.values(await this.getCpvmsByPvcName()),
      async (cpvms: any) => {
        await mapSeries(cpvms, async ({ pod, volumeMount, volume }: any) => {
          const { mountPath } = volumeMount;
          const pvcName = volume?.persistentVolumeClaim?.claimName;
          const volumeName = volume?.name;
          const backupPath = path.resolve(workingPath, pvcName);
          await fs.mkdirs(backupPath);
          logger.info(
            `kubectl cp ${backupScriptPath} ${pod.metadata.namespace}/${pod.metadata.name}:${mountPath}/${prefix}_backup.sh`
          );
          logger.info(
            `kubectl exec -n ${pod.metadata.namespace} ${pod.metadata.name} -- sh -c "cd ${mountPath} && KUBEDUMP_DRYRUN=${dryrun} sh ${mountPath}/${prefix}_backup.sh ${prefix} ${volumeName}"`
          );
          logger.info(
            `kubectl cp -r ${pod.metadata.namespace}/${pod.metadata.name}:${mountPath}/${prefix}/payload/payload.tar.gz ${backupPath}/payload.tar.gz`
          );
          logger.info(
            `kubectl exec -n ${pod.metadata.namespace} ${pod.metadata.name} -- sh -c "rm ${mountPath}/${prefix}_backup.sh && rm -rf ${mountPath}/${prefix}"`
          );
          logger.info();
        });
      }
    );
  }

  async getCpvmsByPvcName() {
    return Object.entries(await this.getPvsByPvcName()).reduce(
      (cpvmsByPvcName: any, [pvcName, { pod, volume }]: [string, any]) => {
        const cpvms = Object.values(
          pod.spec.containers
            .reduce((cpvms: any[], container: any) => {
              return [
                ...cpvms,
                ...container.volumeMounts.reduce(
                  (cpvms: any[], volumeMount: any) => {
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
            .reduce((cpvms: any, cpvm: any) => {
              const { mountPath, name, subPath } = cpvm.volumeMount;
              cpvms[
                `${mountPath}:${name}${subPath ? `:${subPath}` : ''}`
              ] = cpvm;
              return cpvms;
            }, {})
        );
        const rootCpvm: any = cpvms.reduce((rootCpvm: any, cpvm: any) => {
          const { volumeMount } = cpvm;
          if (!volumeMount.subPath) rootCpvm[volumeMount.name] = cpvm;
          return rootCpvm;
        }, {});
        cpvmsByPvcName[pvcName] = cpvms.reduce((cpvms: any, cpvm: any) => {
          const { volumeMount } = cpvm;
          if (rootCpvm[volumeMount.name]) {
            const nameSet = new Set(
              cpvms.map(({ volumeMount }: any) => volumeMount.name)
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

  async getPvsByPvcName() {
    return (await this.getPods()).reduce((pods: any, pod: any) => {
      pod.spec.volumes.map((volume: any) => {
        const claimName = volume?.persistentVolumeClaim?.claimName;
        if (claimName) pods[claimName] = { pod, volume };
      });
      return pods;
    }, {});
  }

  async getPods() {
    return (await kubectl('get', 'pods', '--all-namespaces')).items;
  }

  async getPvcs() {
    return (await kubectl('get', 'pvc', '--all-namespaces')).items;
  }
}
