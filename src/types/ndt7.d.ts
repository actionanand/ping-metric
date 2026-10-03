declare module '@m-lab/ndt7' {
  interface NdtConfig {
    metadata: Record<string, string>;
    userAcceptedDataPolicy: boolean;
    downloadworkerfile?: string;
    uploadworkerfile?: string;
  }
  interface NdtCallbacks {
    error?: (error: string | Error) => void;
    serverDiscovery?: (data: { loadbalancer: URL }) => void;
    serverChosen?: (data: unknown) => void;
    downloadStart?: (data: unknown) => void;
    uploadStart?: (data: unknown) => void;
    downloadMeasurement?: (data: NdtMeasurement) => void;
    uploadMeasurement?: (data: NdtMeasurement) => void;
    downloadComplete?: (data: NdtComplete) => void;
    uploadComplete?: (data: NdtComplete) => void;
  }
  interface NdtMeasurement {
    Source: 'client' | 'server';
    Data: unknown;
  }
  interface NdtComplete {
    LastClientMeasurement?: unknown;
    LastServerMeasurement?: unknown;
  }
  export function test(config: NdtConfig, callbacks: NdtCallbacks): Promise<number | undefined>;
}
