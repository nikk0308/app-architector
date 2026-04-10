export class StorageService {
  async set(key: string, value: string): Promise<void> {
    console.log(key, value);
  }
}
