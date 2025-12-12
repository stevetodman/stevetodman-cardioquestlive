type LevelSubscriber = (level: number) => void;
type TurnCompleteSubscriber = (blob: Blob) => void;
type PermissionSubscriber = (status: MicStatus) => void;

export type MicStatus = "unknown" | "prompt" | "granted" | "blocked";

const AudioContextCtor: typeof AudioContext | undefined =
  typeof window !== "undefined"
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : undefined;

export class VoicePatientService {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private subscribers = new Set<LevelSubscriber>();
  private turnSubscribers = new Set<TurnCompleteSubscriber>();
  private permissionSubscribers = new Set<PermissionSubscriber>();
  private capturing = false;
  private visibilityHandlerBound: (() => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private micStatus: MicStatus = "unknown";

  constructor() {
    if (typeof document !== "undefined") {
      this.visibilityHandlerBound = this.handleVisibilityChange.bind(this);
      document.addEventListener("visibilitychange", this.visibilityHandlerBound);
    }
  }

  async ensureMic(): Promise<void> {
    await this.checkPermission();
    if (this.micStatus === "blocked") {
      throw new Error("Microphone blocked");
    }
    if (this.stream && this.stream.active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not supported");
    }
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.setMicStatus("granted");
    } catch (err: any) {
      const name = err?.name || err?.code;
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.setMicStatus("blocked");
      }
      throw err;
    }
  }

  async startCapture(): Promise<void> {
    if (this.capturing) return;
    await this.ensureMic();
    if (!this.stream) throw new Error("No audio stream");
    if (!AudioContextCtor) throw new Error("AudioContext not available");

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextCtor();
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.source.connect(this.analyser);

    this.recordedChunks = [];
    if (typeof MediaRecorder !== "undefined") {
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: "audio/webm" });
      this.mediaRecorder.ondataavailable = (evt: BlobEvent) => {
        if (evt.data && evt.data.size > 0) {
          this.recordedChunks.push(evt.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || "audio/webm" });
          this.emitTurnComplete(blob);
        }
        this.recordedChunks = [];
      };
      this.mediaRecorder.start();
    } else {
      console.warn("MediaRecorder not available; audio capture will be RMS-only.");
    }

    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.capturing = true;

    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centered = (dataArray[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      this.emitLevel(rms);
      this.rafId = requestAnimationFrame(tick);
    };

    tick();
  }

  stopCapture(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;
    if (this.source && this.analyser) {
      try {
        this.source.disconnect(this.analyser);
      } catch {
        // ignore
      }
    }
    this.source = null;
    this.analyser = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.capturing = false;
    this.emitLevel(0);
  }

  onLevel(callback: LevelSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  onTurnComplete(callback: TurnCompleteSubscriber): () => void {
    this.turnSubscribers.add(callback);
    return () => this.turnSubscribers.delete(callback);
  }

  onPermissionChange(callback: PermissionSubscriber): () => void {
    this.permissionSubscribers.add(callback);
    callback(this.micStatus);
    return () => this.permissionSubscribers.delete(callback);
  }

  async recheckPermission(): Promise<MicStatus> {
    await this.checkPermission();
    return this.micStatus;
  }

  /**
   * Explicitly request microphone permission (Safari-compatible).
   * On Safari, the Permissions API doesn't support microphone queries,
   * so we must call getUserMedia to trigger the permission prompt.
   * The stream is immediately released after permission is granted.
   */
  async requestPermission(): Promise<MicStatus> {
    // First try the Permissions API (works on Chrome/Firefox)
    await this.checkPermission();
    if (this.micStatus === "granted") return "granted";
    if (this.micStatus === "blocked") return "blocked";

    // On Safari or when Permissions API returns "prompt", we must call getUserMedia
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setMicStatus("blocked");
      return "blocked";
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately release the stream - we just needed to trigger the prompt
      stream.getTracks().forEach((t) => t.stop());
      this.setMicStatus("granted");
      return "granted";
    } catch (err: any) {
      const name = err?.name || err?.code;
      if (name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError") {
        this.setMicStatus("blocked");
        return "blocked";
      }
      // Other errors (e.g., AbortError) - leave as prompt
      this.setMicStatus("prompt");
      return "prompt";
    }
  }

  /** Get current mic status without triggering a permission request */
  getMicStatus(): MicStatus {
    return this.micStatus;
  }

  private emitLevel(level: number) {
    this.subscribers.forEach((cb) => {
      try {
        cb(level);
      } catch (err) {
        console.error("Level subscriber error", err);
      }
    });
  }

  private setMicStatus(status: MicStatus) {
    this.micStatus = status;
    this.permissionSubscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error("Permission subscriber error", err);
      }
    });
  }

  private async checkPermission() {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "granted") this.setMicStatus("granted");
      else if (status.state === "denied") this.setMicStatus("blocked");
      else this.setMicStatus("prompt");
      status.onchange = () => {
        const next = status.state === "granted" ? "granted" : status.state === "denied" ? "blocked" : "prompt";
        this.setMicStatus(next);
      };
    } catch (err) {
      // Permissions API not supported or blocked; leave as-is
    }
  }

  private emitTurnComplete(blob: Blob) {
    this.turnSubscribers.forEach((cb) => {
      try {
        cb(blob);
      } catch (err) {
        console.error("Turn complete subscriber error", err);
      }
    });
  }

  private handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      this.stopCapture();
    }
  }
}

export const voicePatientService = new VoicePatientService();
