export interface AudioContexts {
    input: AudioContext;
    output: AudioContext;
}

export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    ERROR = 'ERROR'
}

export interface StreamConfig {
    model: string;
    voiceName: string;
}