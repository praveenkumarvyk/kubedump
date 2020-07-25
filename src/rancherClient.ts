import { AxiosInstance } from 'axios';
import { createAxios } from './axios';

export default class RancherClient {
  api: AxiosInstance;

  constructor(options: RancherClientOptions) {
    this.api = createAxios({ debug: options.debug }).create({
      baseURL: options.endpoint,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getClusters(): Promise<any> {
    return (await this.api.get('/clusters')).data;
  }

  async getCluster(clusterId: string): Promise<any> {
    return (await this.api.get(`/clusters/${clusterId}`)).data;
  }

  async getProjects(clusterId: string): Promise<any> {
    return (await this.api.get(`/clusters/${clusterId}/projects`)).data;
  }

  async getApps(projectId: string): Promise<any> {
    return (await this.api.get(`/project/${projectId}/apps`)).data;
  }
}

export interface RancherClientOptions {
  debug: boolean;
  endpoint: string;
  token: string;
}
