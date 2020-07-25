import os from 'os';
import path from 'path';
import Dump, { DumpOptions } from './dump';

export default class RancherAnswersDump extends Dump {
  public options: RancherAnswersDumpOptions;

  public workingPath = path.resolve(os.tmpdir(), 'kubedump/dump');

  constructor(options: Partial<RancherAnswersDumpOptions> = {}) {
    super();
    this.options = {
      allNamespaces: false,
      ...options
    };
  }

  async dump(ns?: string) {
    if (!ns && !this.options.allNamespaces) {
      ns = this.options.ns || (await this.getActiveNs());
    }
    console.log({
      ...this.options,
      ns
    });
  }
}

export interface RancherAnswersDumpOptions extends DumpOptions {
  rancherEndpoint?: string;
  rancherToken?: string;
}
