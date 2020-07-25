import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import RancherAnswersDump from './rancherAnswersDump';
import VolumeDump from './volumeDump';
import { pack } from './pack';

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
    await this.volumeDump.dump(ns);
    await this.rancherAnswersDump.dump(ns);
    if (this.options.dryrun) return;
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

export interface KubeDumpOptions {
  allNamespaces?: boolean;
  dryrun: boolean;
  ns?: string;
  output: string;
  privileged: boolean;
  skipNamespaces: Set<string>;
}
