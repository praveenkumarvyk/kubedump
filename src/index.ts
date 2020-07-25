import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import VolumeDump, { VolumeDumpOptions } from './volumeDump';
import { pack } from './pack';
import RancherAnswersDump, {
  RancherAnswersDumpOptions
} from './rancherAnswersDump';

export default class KubeDump {
  public options: KubeDumpOptions;

  public volumeDump: VolumeDump;

  public rancherAnswersDump: RancherAnswersDump;

  public workingPath = path.resolve(
    os.tmpdir(),
    'kubedump/dump',
    Date.now().toString()
  );

  constructor(options: Partial<KubeDumpOptions> = {}) {
    this.options = {
      allNamespaces: false,
      dryrun: false,
      privileged: false,
      rancherCluster: '',
      rancherEndpoint: '',
      rancherToken: '',
      skipNamespaces: new Set(),
      ...options,
      output: options.output || path.resolve(process.cwd())
    };
    this.rancherAnswersDump = new RancherAnswersDump(this.options);
    this.volumeDump = new VolumeDump(this.options);
    this.rancherAnswersDump.workingPath = this.workingPath;
    this.volumeDump.workingPath = this.workingPath;
  }

  async dump(ns?: string) {
    const dumpAll =
      typeof this.options.rancherDump === 'undefined' &&
      typeof this.options.volumeDump === 'undefined';
    if (dumpAll || this.options.volumeDump) {
      await this.volumeDump.dump(ns);
    }
    if (dumpAll || this.options.rancherDump) {
      await this.rancherAnswersDump.dump(ns);
    }
    if (this.options.dryrun) return;
    if (await fs.pathExists(this.workingPath)) {
      await fs.mkdirp(this.options.output);
      await pack(
        this.workingPath,
        path.resolve(
          this.options.output,
          `kubedump_${Date.now().toString()}.tar.gz`
        )
      );
      await fs.remove(this.workingPath);
    }
  }
}

export interface KubeDumpOptions
  extends RancherAnswersDumpOptions,
    VolumeDumpOptions {
  output: string;
  rancherDump?: boolean;
  volumeDump?: boolean;
}
