export interface EngineMessage {
    type: string;
    requestId: string;
    payload: string;
};

export interface StreamEntry {
    id: string;
    message: EngineMessage;
}

export interface StreamResponse {
    messages: StreamEntry[];
};
  
export type CallbackEntry<T = unknown> = {
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
};
