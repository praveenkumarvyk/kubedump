import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import Dump, { DumpOptions } from './dump';
import RancherClient from './rancherClient';

export default class RancherAnswersDump extends Dump {
  public options: RancherAnswersDumpOptions;

  public workingPath = path.resolve(os.tmpdir(), 'kubedump/dump');

  public rancherClient: RancherClient;

  constructor(options: Partial<RancherAnswersDumpOptions> = {}) {
    super();
    this.options = {
      allNamespaces: false,
      rancherCluster: '',
      rancherEndpoint: '',
      rancherToken: '',
      skipNamespaces: new Set(),
      ...options
    };
    if (
      !this.options.rancherEndpoint &&
      !this.options.rancherToken &&
      !this.options.rancherCluster
    ) {
      throw new Error('rancher endpoint and token are required');
    }
    this.rancherClient = new RancherClient({
      debug: false,
      endpoint: this.options.rancherEndpoint!,
      token: this.options.rancherToken!
    });
  }

  async getProjectIds() {
    const projects = await this.rancherClient.getProjects(
      this.options.rancherCluster
    );
    return (projects?.data || []).map((project: any) => project.id);
  }

  async getApps(): Promise<App[]> {
    return (
      await Promise.all(
        (await this.getProjectIds()).map((projectId: string) => {
          return this.rancherClient.getApps(projectId);
        })
      )
    ).reduce((apps: App[], appGroup: any) => {
      apps = [...apps, ...appGroup.data];
      return apps;
    }, []);
  }

  async dump(ns?: string) {
    if (!ns && !this.options.allNamespaces) {
      ns = this.options.ns || (await this.getActiveNs());
    }
    await Promise.all(
      (await this.getApps()).map(async (app: App) => {
        if (
          (ns && app.targetNamespace !== ns) ||
          this.options.skipNamespaces.has(app.targetNamespace)
        ) {
          return;
        }
        const namespacePath = path.resolve(
          this.workingPath,
          app.targetNamespace
        );
        const appPath = path.resolve(namespacePath, 'apps', app.name);
        await fs.mkdirp(appPath);
        const answersData = Object.entries(app.answers || {})
          .map(([key, value]: [string, any]) => {
            let valueString = '';
            if (typeof value !== 'undefined' && value !== null) {
              if (
                typeof value === 'object' &&
                !(value instanceof RegExp) &&
                !Array.isArray(value)
              ) {
                valueString = JSON.stringify(value);
              } else {
                valueString = value.toString();
              }
            }
            return `${key}: ${valueString}`;
          })
          .join('\n');
        await fs.writeFile(path.resolve(appPath, 'answers.txt'), answersData);
      })
    );
  }
}

export interface RancherAnswersDumpOptions extends DumpOptions {
  rancherCluster: string;
  rancherEndpoint: string;
  rancherToken: string;
}

export interface App {
  answers: Answers;
  name: string;
  targetNamespace: string;
}

export interface Answers {
  [key: string]: any;
}
