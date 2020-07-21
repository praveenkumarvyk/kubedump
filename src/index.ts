import kubectl from './kubectl';
import { mapSeries } from './helpers';
import { name } from '../package.json';

const prefix = `__${name}_`;

export default class KubeDump {
  async dump() {
    await mapSeries(
      Object.values(await this.getCpvmsByPvcName()),
      async (cpvms: any) => {
        await mapSeries(cpvms, async ({ pod, volumeMount }: any) => {
          const { mountPath } = volumeMount;
          console.log(
            `kubectl cp backup.sh ${pod.metadata.name}:${mountPath}/${prefix}backup.sh`
          );
          console.log(
            `kubectl exec -it ${pod.metadata.name} -- cd ${mountPath} && sh ${prefix}backup.sh ${prefix} && rm ${prefix}backup.sh`
          );
          console.log();
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
                `${mountPath}:${name}${subPath ? ':' + subPath : ''}`
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
