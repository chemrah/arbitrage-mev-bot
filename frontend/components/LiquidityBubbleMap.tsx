'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, TrendingUp, AlertTriangle } from 'lucide-react';

interface PoolData {
  id: string;
  pair: string;
  liquidity: number;
  volume24h: number;
  volatility: number;
  feeTier: number;
  x: number;
  y: number;
  color: string;
}

interface LiquidityBubbleMapProps {
  pools?: PoolData[];
  className?: string;
}

export default function LiquidityBubbleMap({ pools = [], className = '' }: LiquidityBubbleMapProps) {
  const [bubbleData, setBubbleData] = useState<PoolData[]>([]);
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);
  const [hoveredPool, setHoveredPool] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pools.length > 0) {
      setBubbleData(pools);
    } else {
      // Generate simulated pool data
      const simulatedPools: PoolData[] = [
        {
          id: '1',
          pair: 'WETH/USDC',
          liquidity: 450000000,
          volume24h: 120000000,
          volatility: 0.032,
          feeTier: 0.05,
          x: 30,
          y: 25,
          color: '#00ff88',
        },
        {
          id: '2',
          pair: 'WETH/LINK',
          liquidity: 280000000,
          volume24h: 85000000,
          volatility: 0.045,
          feeTier: 0.3,
          x: 70,
          y: 35,
          color: '#4488ff',
        },
        {
          id: '3',
          pair: 'USDC/LINK',
          liquidity: 150000000,
          volume24h: 45000000,
          volatility: 0.038,
          feeTier: 0.3,
          x: 50,
          y: 60,
          color: '#ffaa00',
        },
        {
          id: '4',
          pair: 'WETH/DAI',
          liquidity: 320000000,
          volume24h: 95000000,
          volatility: 0.029,
          feeTier: 0.05,
          x: 20,
          y: 70,
          color: '#ff4444',
        },
        {
          id: '5',
          pair: 'WBTC/WETH',
          liquidity: 210000000,
          volume24h: 67000000,
          volatility: 0.051,
          feeTier: 0.3,
          x: 80,
          y: 75,
          color: '#aa88ff',
        },
      ];
      setBubbleData(simulatedPools);
    }
  }, [pools]);

  const getBubbleSize = (liquidity: number) => {
    const minSize = 40;
    const maxSize = 120;
    const minLiquidity = 100000000;
    const maxLiquidity = 500000000;
    
    const ratio = (liquidity - minLiquidity) / (maxLiquidity - minLiquidity);
    return minSize + ratio * (maxSize - minSize);
  };

  const getBubbleColor = (volatility: number) => {
    if (volatility > 0.05) return 'bg-red-500/20 border-red-500/50';
    if (volatility > 0.03) return 'bg-yellow-500/20 border-yellow-500/50';
    return 'bg-green-500/20 border-green-500/50';
  };

  return (
    <div className={`bg-arb-panel rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-arb-accent font-mono text-lg flex items-center gap-2">
            <Droplets size={18} />
            Liquidity Bubble Map
          </h3>
          <p className="text-gray-400 text-sm mt-1">Pool size = Liquidity | Color = Volatility</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
            <span className="text-xs text-gray-400">Low Vol</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <span className="text-xs text-gray-400">Med Vol</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <span className="text-xs text-gray-400">High Vol</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[400px] bg-arb-dark rounded-lg overflow-hidden"
      >
        <AnimatePresence>
          {bubbleData.map((pool) => (
            <motion.div
              key={pool.id}
              className={`absolute rounded-full border-2 cursor-pointer flex items-center justify-center ${getBubbleColor(pool.volatility)}`}
              style={{
                left: `${pool.x}%`,
                top: `${pool.y}%`,
                width: getBubbleSize(pool.liquidity),
                height: getBubbleSize(pool.liquidity),
                transform: 'translate(-50%, -50%)',
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setHoveredPool(pool.id)}
              onMouseLeave={() => setHoveredPool(null)}
              onClick={() => setSelectedPool(pool)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-mono text-white text-center px-1">
                {pool.pair}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {hoveredPool && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 bg-arb-panel/90 border border-arb-accent/30 rounded-lg p-3 z-10"
          >
            {(() => {
              const pool = bubbleData.find((p) => p.id === hoveredPool);
              if (!pool) return null;
              return (
                <div className="space-y-1">
                  <div className="text-arb-accent font-mono text-sm">{pool.pair}</div>
                  <div className="text-gray-400 text-xs">
                    Liquidity: ${(pool.liquidity / 1e6).toFixed(1)}M
                  </div>
                  <div className="text-gray-400 text-xs">
                    Volume 24h: ${(pool.volume24h / 1e6).toFixed(1)}M
                  </div>
                  <div className="text-gray-400 text-xs">
                    Volatility: {(pool.volatility * 100).toFixed(2)}%
                  </div>
                  <div className="text-gray-400 text-xs">Fee: {pool.feeTier}%</div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {selectedPool && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-arb-dark/80 flex items-center justify-center z-20"
            onClick={() => setSelectedPool(null)}
          >
            <div className="bg-arb-panel border border-arb-accent/30 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-arb-accent font-mono text-lg">{selectedPool.pair}</h4>
                <button
                  onClick={() => setSelectedPool(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Liquidity</span>
                  <span className="text-white font-mono">
                    ${(selectedPool.liquidity / 1e6).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Volume 24h</span>
                  <span className="text-white font-mono">
                    ${(selectedPool.volume24h / 1e6).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Volatility</span>
                  <span className="text-white font-mono">
                    {(selectedPool.volatility * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fee Tier</span>
                  <span className="text-white font-mono">{selectedPool.feeTier}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}