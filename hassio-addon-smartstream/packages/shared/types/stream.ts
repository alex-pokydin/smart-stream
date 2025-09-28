export interface StreamConfig {
  inputUrl: string;
  outputUrl?: string;
  quality?: string;
  fps?: number;
  resolution?: string;
  bitrate?: string;
}

export interface StreamStatus {
  id: string;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  stats: StreamStats;
}

export interface StreamStats {
  fps: number;
  size: string;
  time: string;
  bitrate: string;
  speed: string;
  cpu: number[];
}

export interface FFmpegOptions {
  input: string;
  output?: string;
  videoCodec?: string;
  audioCodec?: string;
  preset?: string;
  crf?: number;
  maxrate?: string;
  bufsize?: string;
  keyint?: number;
  framerate?: number;
  resolution?: string;
  customArgs?: string[];
}
