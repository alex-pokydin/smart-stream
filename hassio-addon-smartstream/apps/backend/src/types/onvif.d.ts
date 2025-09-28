declare module 'onvif' {
  export interface CameraInfo {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
  }

  export interface CamOptions {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
  }

  export interface StreamUri {
    uri: string;
  }

  export interface SnapshotUri {
    uri: string;
  }

  export class Cam {
    constructor(options: CamOptions, callback?: (error?: Error) => void);
    getStreamUris(): Promise<StreamUri[]>;
    getSnapshotUri(): Promise<SnapshotUri>;
  }

  export interface DiscoveryOptions {
    timeout?: number;
  }

  export namespace Discovery {
    export function probe(
      options: DiscoveryOptions,
      callback: (error: Error | null, cameras?: CameraInfo[]) => void
    ): void;
  }
}
