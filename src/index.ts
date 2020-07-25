import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import VolumeDump from './volumeDump';
import { pack } from './pack';

export default class KubeDump {
  public options: KubeDumpOptions;

  public volumeDump: VolumeDump;

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
      output: options.output || path.resolve(process.cwd(), 'kubedump')
    };
    this.volumeDump = new VolumeDump(this.options);
    this.volumeDump.workingPath = this.workingPath;
  }

  async dump(ns?: string) {
    await this.volumeDump.dump(ns);
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
