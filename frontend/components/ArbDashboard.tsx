'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Play, Pause, Zap, TrendingUp, AlertTriangle, Activity, Clock, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { arbWsClient, type ArbOpportunity as WsArbOpp, type TelemetryData, type WsMessage } from '../services/wsClient';

interface ArbDisplay {
  id: string;
  pair: string;
  type: string;
  profit: number;
  successRate: number;
  ltv: number;
  latency: number;
  status: 'scanning' | 'profitable' | 'executing' | 'completed' | 'failed';
}

export default function ArbDashboard() {
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [tipPercentage, setTipPercentage] = useState(85);
  const [opportunities, setOpportunities] = useState<ArbDisplay[]>([]);
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState({
    eventCapture: 0,
    mathComputation: 0,
    evmSimulation: 0,
    bundleSubmission: 0,
    totalLatency: 0,
  });
  const [profitHistory, setProfitHistory] = useState([{ time: 0, profit: 0 }]);

  // Connect to Rust backend via WebSocket
  useEffect(() => {
    arbWsClient.connect();

    const unsubscribe = arbWsClient.onMessage((msg: WsMessage) => {
      if (msg.type === 'opportunity' && msg.data) {
        const opp = msg.data;
        const display: ArbDisplay = {
          id: opp.id,
          pair: opp.pair_path?.join(' / ') || 'Unknown',
          type: opp.arbitrage_type || 'Unknown',
          profit: opp.expected_profit / 1e18,
          successRate: opp.success_probability * 100,
          ltv: opp.required_capital > 0 ? opp.expected_profit / opp.required_capital : 0,
          latency: opp.latency_micros,
          status: opp.expected_profit > 0 ? 'profitable' : 'scanning',
        };
        setOpportunities((prev) => [display, ...prev].slice(0, 10));
        setProfitHistory((prev) => [...prev.slice(-50), { time: Date.now(), profit: display.profit }]);
      }
      if (msg.type === 'telemetry' && msg.data) {
        const tel = msg.data;
        setTelemetry({
          eventCapture: tel.event_capture,
          mathComputation: tel.math_computation,
          evmSimulation: tel.evm_simulation,
          bundleSubmission: tel.bundle_submission,
          totalLatency: tel.total_latency,
        });
      }
    });

    // Check connection status
    const connCheck = setInterval(() => {
      setConnected(arbWsClient['ws']?.readyState === WebSocket.OPEN);
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(connCheck);
      arbWsClient.disconnect();
    };
  }, []);

  // Fallback mock data when not connected
  useEffect(() => {
    if (connected) return;

    const interval = setInterval(() => {
      const newOpp: ArbDisplay = {
        id: `arb-${Date.now()}`,
        pair: ['WETH/USDC', 'WETH/LINK', 'USDC/LINK'][Math.floor(Math.random() * 3)],
        type: ['Triangular V3', 'Cross-Pool V3/V4', 'CEX-DEX', 'Flash Loan JIT'][Math.floor(Math.random() * 4)],
        profit: Math.random() * 5000 + 100,
        successRate: Math.random() * 30 + 70,
        ltv: Math.random() * 0.8 + 0.1,
        latency: Math.random() * 1500,
        status: 'scanning',
      };

      setOpportunities((prev) => {
        const updated = [newOpp, ...prev].slice(0, 10);
        return updated;
      });

      setProfitHistory((prev) => {
        const newPoint = { time: Date.now(), profit: newOpp.profit };
        return [...prev.slice(-50), newPoint];
      });

      setTelemetry({
        eventCapture: 450 + Math.random() * 100,
        mathComputation: 120 + Math.random() * 50,
        evmSimulation: 350 + Math.random() * 100,
        bundleSubmission: 200 + Math.random() * 50,
        totalLatency: 1120 + Math.random() * 200,
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [connected]);

  const executeArbitrage = useCallback((id: string) => {
    setOpportunities((prev) =>
      prev.map((opp) => (opp.id === id ? { ...opp, status: 'executing' } : opp))
    );

    setTimeout(() => {
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === id
            ? { ...opp, status: Math.random() > 0.3 ? 'completed' : 'failed' }
            : opp
        )
      );
    }, 2000);
  }, []);

  const slippageData = [
    { tolerance: '0.1%', success: 85, sandwich: 5, failed: 10 },
    { tolerance: '0.5%', success: 78, sandwich: 12, failed: 10 },
    { tolerance: '1.0%', success: 65, sandwich: 12, failed: 23 },
    { tolerance: '2.0%', success: 52, sandwich: 22, failed: 26 },
    { tolerance: '3.0%', success: 40, sandwich: 35, failed: 25 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-arb-panel rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap size={20} className={isAutoPilot ? 'text-arb-accent' : 'text-gray-400'} />
            <span className="text-white font-semibold">Auto-Pilot</span>
            <button
              onClick={() => setIsAutoPilot(!isAutoPilot)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isAutoPilot ? 'bg-arb-accent' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isAutoPilot ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-arb-accent" />
            <span className="text-white text-sm">Tip: {tipPercentage}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={tipPercentage}
              onChange={(e) => setTipPercentage(Number(e.target.value))}
              className="w-32 accent-arb-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {connected && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Engine Connected
            </div>
          )}
          <div className="text-right">
            <div className="text-arb-accent font-mono text-2xl font-bold">
              ${profitHistory[profitHistory.length - 1]?.profit.toFixed(2) || '0.00'}
            </div>
            <div className="text-gray-400 text-xs">Latest Profit</div>
          </div>
        </div>
      </div>

      <div className="bg-arb-panel rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-arb-accent font-mono text-lg">Arbitrage Opportunities</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-arb-dark">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 text-xs font-mono">PAIR</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs font-mono">TYPE</th>
                <th className="px-4 py-3 text-right text-gray-400 text-xs font-mono">PROFIT</th>
                <th className="px-4 py-3 text-right text-gray-400 text-xs font-mono">SUCCESS</th>
                <th className="px-4 py-3 text-right text-gray-400 text-xs font-mono">LTV</th>
                <th className="px-4 py-3 text-right text-gray-400 text-xs font-mono">LATENCY</th>
                <th className="px-4 py-3 text-center text-gray-400 text-xs font-mono">ACTION</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {opportunities.map((opp) => (
                  <motion.tr
                    key={opp.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="border-b border-gray-800 hover:bg-arb-dark/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-mono text-sm">{opp.pair}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{opp.type}</td>
                    <td className="px-4 py-3 text-right text-arb-accent font-mono text-sm">
                      ${opp.profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-sm">
                      {opp.successRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-sm">
                      {(opp.ltv * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-sm">
                      {opp.latency.toFixed(0)}μs
                    </td>
                    <td className="px-4 py-3 text-center">
                      {opp.status === 'scanning' && (
                        <button
                          onClick={() => executeArbitrage(opp.id)}
                          className="bg-arb-accent text-arb-dark px-3 py-1 rounded text-sm font-semibold hover:bg-arb-accent-dim transition-colors"
                        >
                          Execute
                        </button>
                      )}
                      {opp.status === 'executing' && (
                        <span className="text-yellow-400 text-sm flex items-center justify-center gap-1">
                          <Activity size={14} className="animate-pulse" />
                          Executing...
                        </span>
                      )}
                      {opp.status === 'completed' && (
                        <span className="text-green-400 text-sm flex items-center justify-center gap-1">
                          <TrendingUp size={14} />
                          Completed
                        </span>
                      )}
                      {opp.status === 'failed' && (
                        <span className="text-red-400 text-sm flex items-center justify-center gap-1">
                          <AlertTriangle size={14} />
                          Failed
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-arb-panel rounded-lg p-6">
          <h3 className="text-arb-accent font-mono text-lg mb-4">Profit History</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitHistory}>
                <defs>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="time" tick={{ fill: '#666' }} tickFormatter={() => ''} />
                <YAxis tick={{ fill: '#666' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#11111a', border: '1px solid #00ff88', borderRadius: '8px' }}
                  labelStyle={{ color: '#00ff88' }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#00ff88"
                  fill="url(#profitGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-arb-panel rounded-lg p-6">
          <h3 className="text-arb-accent font-mono text-lg mb-4">Slippage Heatmap</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 font-mono mb-2">
              <div>Slippage</div>
              <div className="text-green-400">Success</div>
              <div className="text-red-400">Sandwich Risk</div>
              <div className="text-gray-400">Failed</div>
            </div>
            {slippageData.map((row) => (
              <div key={row.tolerance} className="grid grid-cols-4 gap-2 items-center">
                <div className="text-white font-mono text-sm">{row.tolerance}</div>
                <div className="h-4 bg-green-900/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${row.success}%` }}
                  />
                </div>
                <div className="h-4 bg-red-900/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${row.sandwich}%` }}
                  />
                </div>
                <div className="h-4 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-gray-500 transition-all duration-500"
                    style={{ width: `${row.failed}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-arb-panel rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-arb-accent" />
          <h3 className="text-arb-accent font-mono text-lg">Microsecond Telemetry</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-arb-dark rounded-lg p-4">
            <div className="text-gray-400 text-xs font-mono mb-1">Event Capture</div>
            <div className="text-arb-accent font-mono text-xl">{telemetry.eventCapture.toFixed(0)}μs</div>
          </div>
          <div className="bg-arb-dark rounded-lg p-4">
            <div className="text-gray-400 text-xs font-mono mb-1">Math Compute</div>
            <div className="text-arb-accent font-mono text-xl">{telemetry.mathComputation.toFixed(0)}μs</div>
          </div>
          <div className="bg-arb-dark rounded-lg p-4">
            <div className="text-gray-400 text-xs font-mono mb-1">EVM Sim</div>
            <div className="text-arb-accent font-mono text-xl">{telemetry.evmSimulation.toFixed(0)}μs</div>
          </div>
          <div className="bg-arb-dark rounded-lg p-4">
            <div className="text-gray-400 text-xs font-mono mb-1">Bundle Submit</div>
            <div className="text-arb-accent font-mono text-xl">{telemetry.bundleSubmission.toFixed(0)}μs</div>
          </div>
          <div className="bg-arb-dark rounded-lg p-4 border border-arb-accent/30">
            <div className="text-gray-400 text-xs font-mono mb-1">Total Latency</div>
            <div className="text-arb-accent font-mono text-xl">{telemetry.totalLatency.toFixed(0)}μs</div>
          </div>
        </div>
      </div>
    </div>
  );
}
