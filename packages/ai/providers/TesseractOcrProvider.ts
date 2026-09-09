import { createWorker, Worker } from "tesseract.js";

import { ProviderImage } from "./ImageCapableProvider";
import { OcrProvider } from "./OcrProvider";

const DEFAULT_LANGUAGE = "eng";

/**
 * First (and, for this milestone, only) OcrProvider implementation —
 * Tesseract.js, a WASM port of the Tesseract OCR engine that runs
 * entirely in Node with no system binary/native dependency, which is
 * what makes it viable across this repo's actual deployment targets
 * (Docker alpine, Netlify, Vercel serverless).
 *
 * One worker is created lazily on first use and reused across calls
 * on the same instance — tesseract.js's own docs recommend this over
 * creating a worker per recognize() call. Callers that are done with
 * an instance (e.g. after enriching one document) should call
 * terminate() to release it.
 */
export class TesseractOcrProvider implements OcrProvider {
  private workerPromise: Promise<Worker> | null = null;

  constructor(private readonly language: string = DEFAULT_LANGUAGE) {}

  private getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker(this.language);
    }
    return this.workerPromise;
  }

  async extractText(image: ProviderImage): Promise<string> {
    const worker = await this.getWorker();

    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;
    const result = await worker.recognize(dataUrl);

    return result.data.text;
  }

  async terminate(): Promise<void> {
    if (!this.workerPromise) {
      return;
    }
    const worker = await this.workerPromise;
    await worker.terminate();
  }
}
