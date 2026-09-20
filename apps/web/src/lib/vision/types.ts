export type VisionInput = { bytes: Uint8Array; mime: string; requestId: string };
export type VisionResult = { text: string };
export interface VisionAdapter { recognize(input: VisionInput): Promise<VisionResult>; }
