type LevelSubscriber = (level: number) => void;

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
  private capturing = false;
  private visibilityHandlerBound: (() => void) | null = null;

  constructor() {
    if (typeof document !== "undefined") {
      this.visibilityHandlerBound = this.handleVisibilityChange.bind(this);
      document.addEventListener("visibilitychange", this.visibilityHandlerBound);
    }
  }

  async ensureMic(): Promise<void> {
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
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
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

  private emitLevel(level: number) {
    this.subscribers.forEach((cb) => {
      try {
        cb(level);
      } catch (err) {
        console.error("Level subscriber error", err);
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
