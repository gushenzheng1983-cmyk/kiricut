declare module "onnxruntime-web" {
  export interface Tensor {
    data: Float32Array | Uint8Array;
  }

  export interface InferenceSession {
    inputNames: string[];
    outputNames: string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }

  export namespace InferenceSession {
    function create(
      buffer: ArrayBuffer,
      options?: { executionProviders?: string[] }
    ): Promise<InferenceSession>;
  }

  export class Tensor {
    constructor(
      type: string,
      data: Float32Array | Uint8Array,
      dims: number[]
    );
  }

  export const env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
      simd: boolean;
    };
  };
}
