import VolumeDump from './volumeDump';

export default class KubeDump {
  public options: KubeDumpOptions;

  public volumeDump: VolumeDump;

  constructor(options: Partial<KubeDumpOptions> = {}) {
    this.options = {
      dryrun: false,
      ...options
    };
    this.volumeDump = new VolumeDump(this.options);
  }

  async dump(ns?: string) {
    await this.volumeDump.dump(ns);
  }
}

export interface KubeDumpOptions {
  dryrun: boolean;
  ns?: string;
}
