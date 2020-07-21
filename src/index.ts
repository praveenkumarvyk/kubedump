import kubectl from './kubectl';

export default class KubeDump {
  async dump() {
    Object.entries(await this.getCpvmsByPvcName()).reduce(
      (cpvms: any, [key, value]: [string, any]) => {
        console.log(
          key,
          value.map(({ volumeMount }: any) => volumeMount)
        );
        return cpvms;
      },
      {}
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
