export class ApiClient {
  readonly baseUrl = 'https://api.example.com';

  async get(path: string): Promise<string> {
    return 'GET ' + path + ' via ' + this.baseUrl;
  }
}
