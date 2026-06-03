export interface ArbOpportunity {
  id: string;
  pair_path: string[];
  arbitrage_type: string;
  expected_profit: number;
  required_capital: number;
  success_probability: number;
  gas_estimate: number;
  latency_micros: number;
  timestamp: number;
  pools: string[];
  slippage_estimate: number;
}

export interface TelemetryData {
  event_capture: number;
  math_computation: number;
  evm_simulation: number;
  bundle_submission: number;
  total_latency: number;
  opportunities_scanned: number;
  opportunities_executed: number;
  total_profit: number;
}

export type WsMessage =
  | { type: 'opportunity'; data: ArbOpportunity }
  | { type: 'telemetry'; data: TelemetryData };

export type MessageHandler = (msg: WsMessage) => void;

export class ArbWebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[ArbWS] Connected to engine');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          this.handlers.forEach((h) => h(msg));
        } catch (e) {
          console.warn('[ArbWS] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[ArbWS] Disconnected, reconnecting in 3s...');
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('[ArbWS] Error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.warn('[ArbWS] Connection failed, retrying in 3s...', e);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const arbWsClient = new ArbWebSocketClient();
