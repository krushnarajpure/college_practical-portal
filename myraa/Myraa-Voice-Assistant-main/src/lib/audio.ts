/**
 * Low-latency, full-duplex audio transport for Gemini Live.
 *
 * Audio is scheduled continuously on the Web Audio timeline.
 * Features:
 * - Smart mic gating during model speech to prevent echo loops / self-triggering.
 * - Turn epoch counter to drop stale audio packets after interruption.
 * - Ultra-low latency scheduling with instant barge-in response.
 */

export type LiveState =
  | "disconnected"
  | "connecting"
  | "listening"
  | "speaking";

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const MIC_BUFFER_SIZE = 512; // 32 ms at 16 kHz
const MAX_WS_BACKLOG_BYTES = 96 * 1024;
const BARGE_IN_RMS_THRESHOLD = 0.022;
const BARGE_IN_COOLDOWN_MS = 250;

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0, offset = 0; i < input.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function pcm16ToFloats(bytes: Uint8Array): Float32Array {
  const int16 = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2,
  );
  const floats = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) floats[i] = int16[i] / 32768;
  return floats;
}

function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export class MyraaAudioSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micProcessorNode: ScriptProcessorNode | null = null;
  private micKeepAliveGain: GainNode | null = null;

  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;

  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private turnCompleteReceived = false;
  private wantsConnection = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private lastBargeInAt = 0;
  private streamEpoch = 0;

  private onStateChange: (state: LiveState) => void;
  private onTranscription: (role: "user" | "model", text: string) => void;
  private onToolCall: (
    name: string,
    args: any,
    callback: (result: any) => void,
  ) => void;
  private onError: (error: string) => void;
  private onMemorySync?: (memories: any[]) => void;
  private onActionStatus?: (status: {
    name: string;
    args: any;
    status: "running" | "done" | "error";
    result?: any;
  }) => void;
  private currentState: LiveState = "disconnected";

  constructor(handlers: {
    onStateChange: (state: LiveState) => void;
    onTranscription: (role: "user" | "model", text: string) => void;
    onToolCall: (
      name: string,
      args: any,
      callback: (result: any) => void,
    ) => void;
    onError: (error: string) => void;
    onMemorySync?: (memories: any[]) => void;
    onActionStatus?: (status: {
      name: string;
      args: any;
      status: "running" | "done" | "error";
      result?: any;
    }) => void;
  }) {
    this.onStateChange = handlers.onStateChange;
    this.onTranscription = handlers.onTranscription;
    this.onToolCall = handlers.onToolCall;
    this.onError = handlers.onError;
    this.onMemorySync = handlers.onMemorySync;
    this.onActionStatus = handlers.onActionStatus;
  }

  private setState(state: LiveState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.onStateChange(state);
  }

  public getState(): LiveState {
    return this.currentState;
  }

  public sendVideoFrame(base64Data: string): void {
    if (
      this.ws?.readyState === WebSocket.OPEN &&
      this.ws.bufferedAmount < MAX_WS_BACKLOG_BYTES
    ) {
      this.ws.send(JSON.stringify({ type: "video", video: base64Data }));
    }
  }

  public async connect(): Promise<void> {
    this.wantsConnection = true;
    if (this.ws || this.currentState === "connecting") return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setState("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
    this.ws = ws;

    ws.onopen = async () => {
      try {
        if (!this.wantsConnection || this.ws !== ws) return;
        await this.startAudio();
        this.reconnectAttempt = 0;
      } catch (error: any) {
        this.onError(`Microphone setup failed: ${error?.message || error}`);
        this.handleTransportLoss(ws);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(
          typeof event.data === "string" ? event.data : String(event.data),
        );
        if (data.type === "error") {
          this.onError(data.error || "Voice connection failed.");
          if (String(data.error || "").startsWith("NO_API_KEY:"))
            this.disconnect();
          return;
        }
        if (data.type === "status") {
          if (data.status === "connected") this.setState("listening");
          if (data.status === "session_closed") this.handleTransportLoss(ws);
          return;
        }
        if (data.type === "audio" && data.audio) {
          this.playAudioPCMChunk(data.audio, this.streamEpoch);
        }
        if (data.type === "interrupted") {
          this.handleInterruption();
        }
        if (data.type === "turnComplete") {
          this.turnCompleteReceived = true;
          this.finishPlaybackIfDrained();
        }
        if (data.type === "transcription")
          this.onTranscription(data.role, data.text);
        if (data.type === "memory_sync" && data.memories)
          this.onMemorySync?.(data.memories);
        if (data.type === "toolCall") {
          this.onToolCall(data.name, data.args, (result) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: "toolResponse",
                  id: data.callId,
                  name: data.name,
                  output: result,
                }),
              );
            }
          });
        }
        if (data.type === "actionStatus") this.onActionStatus?.(data);
      } catch (error) {
        console.error("[Audio] Invalid server packet:", error);
      }
    };
    ws.onerror = () => this.handleTransportLoss(ws);
    ws.onclose = () => this.handleTransportLoss(ws);
  }

  private async startAudio(): Promise<void> {
    if (this.inputAudioCtx && this.outputAudioCtx && this.micStream) return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass)
      throw new Error("Web Audio API is unavailable in this browser.");

    this.inputAudioCtx = new AudioContextClass({
      sampleRate: INPUT_SAMPLE_RATE,
      latencyHint: "interactive",
    });
    this.outputAudioCtx = new AudioContextClass({
      sampleRate: OUTPUT_SAMPLE_RATE,
      latencyHint: "interactive",
    });
    await Promise.all([
      this.inputAudioCtx.resume().catch(() => {}),
      this.outputAudioCtx.resume().catch(() => {}),
    ]);

    this.outputGainNode = this.outputAudioCtx.createGain();
    this.outputGainNode.gain.value = 1.0;
    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.8;
    this.outputGainNode.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.outputAudioCtx.destination);

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.micSourceNode = this.inputAudioCtx.createMediaStreamSource(
      this.micStream,
    );
    this.micSourceNode.connect(this.inputAnalyser);
    this.micProcessorNode = this.inputAudioCtx.createScriptProcessor(
      MIC_BUFFER_SIZE,
      1,
      1,
    );
    this.micKeepAliveGain = this.inputAudioCtx.createGain();
    this.micKeepAliveGain.gain.value = 0;
    this.micSourceNode.connect(this.micProcessorNode);
    this.micProcessorNode.connect(this.micKeepAliveGain);
    this.micKeepAliveGain.connect(this.inputAudioCtx.destination);
    this.micProcessorNode.onaudioprocess = (event) =>
      this.sendMicChunk(event.inputBuffer.getChannelData(0));
  }

  private sendMicChunk(channelData: Float32Array): void {
    if (
      this.currentState === "disconnected" ||
      this.currentState === "connecting"
    )
      return;

    if (this.currentState === "speaking") {
      const level = rms(channelData);
      if (level >= BARGE_IN_RMS_THRESHOLD) {
        this.requestBargeIn();
      } else {
        // Mute outgoing mic chunks while model is speaking to prevent echo loop / feedback
        return;
      }
    }

    if (
      this.ws?.readyState !== WebSocket.OPEN ||
      this.ws.bufferedAmount > MAX_WS_BACKLOG_BYTES
    )
      return;
    this.ws.send(
      JSON.stringify({
        type: "audio",
        audio: base64ArrayBuffer(floatTo16BitPCM(channelData)),
      }),
    );
  }

  private requestBargeIn(): void {
    const now = performance.now();
    if (now - this.lastBargeInAt < BARGE_IN_COOLDOWN_MS) return;
    this.lastBargeInAt = now;
    this.handleInterruption();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "interrupt" }));
    }
  }

  private handleInterruption(): void {
    this.streamEpoch++;
    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    this.turnCompleteReceived = false;
    this.setState("listening");
  }

  private playAudioPCMChunk(base64Audio: string, epoch: number): void {
    if (!this.outputAudioCtx || !this.outputGainNode) return;
    // Discard any chunks belonging to a previous or interrupted turn
    if (epoch !== this.streamEpoch) return;

    try {
      const bytes = base64ToUint8Array(base64Audio);
      const floats = pcm16ToFloats(bytes);
      const buffer = this.outputAudioCtx.createBuffer(
        1,
        floats.length,
        OUTPUT_SAMPLE_RATE,
      );
      buffer.getChannelData(0).set(floats);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.008; // 8ms minimal lookahead
      }

      this.turnCompleteReceived = false;
      this.setState("speaking");

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputGainNode);
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index >= 0) this.activeSources.splice(index, 1);
        try {
          source.disconnect();
        } catch {}
        this.finishPlaybackIfDrained();
      };
    } catch (error) {
      console.error("[Audio] PCM playback error:", error);
    }
  }

  private finishPlaybackIfDrained(): void {
    if (
      this.turnCompleteReceived &&
      this.activeSources.length === 0 &&
      this.currentState === "speaking"
    ) {
      this.nextStartTime = 0;
      this.setState("listening");
    }
  }

  private handleTransportLoss(ws: WebSocket): void {
    if (this.ws !== ws) return;
    this.releaseResources(true);
    if (!this.wantsConnection) return;
    this.setState("connecting");
    const delay = Math.min(250 * 2 ** this.reconnectAttempt++, 3_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  public disconnect(): void {
    this.wantsConnection = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.releaseResources(true);
    this.setState("disconnected");
  }

  private releaseResources(closeSocket: boolean): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      if (closeSocket)
        try {
          ws.close();
        } catch {
          /* ignore */
        }
    }
    this.handleInterruption();
    if (this.micStream)
      this.micStream.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    for (const node of [
      this.micProcessorNode,
      this.micSourceNode,
      this.micKeepAliveGain,
    ]) {
      try {
        node?.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.micProcessorNode = null;
    this.micSourceNode = null;
    this.micKeepAliveGain = null;
    for (const context of [this.inputAudioCtx, this.outputAudioCtx]) {
      try {
        void context?.close();
      } catch {
        /* ignore */
      }
    }
    this.inputAudioCtx = null;
    this.outputAudioCtx = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.outputGainNode = null;
  }
}
