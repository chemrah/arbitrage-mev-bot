'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface MempoolTransaction {
  id: string;
  value: number;
  direction: 'buy' | 'sell';
  pair: string;
  gasPrice: number;
  timestamp: number;
}

interface ParticleProps {
  transaction: MempoolTransaction;
  position: [number, number, number];
}

function TransactionParticle({ transaction, position }: ParticleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = transaction.direction === 'buy' ? '#00ff88' : '#ff4444';
  const size = Math.max(0.1, Math.min(1, transaction.value / 1000));

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.001;
    }
  });

  return (
    <Sphere
      ref={meshRef}
      position={position}
      args={[size, 32, 32]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 2 : 0.5}
        transparent
        opacity={0.8}
      />
      {hovered && (
        <Text
          position={[0, size + 0.5, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {transaction.pair}
        </Text>
      )}
    </Sphere>
  );
}

interface MempoolStreamProps {
  transactions: MempoolTransaction[];
}

function MempoolStream({ transactions }: MempoolStreamProps) {
  const particles = useMemo(() => {
    return transactions.map((tx) => ({
      id: tx.id,
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20,
      ] as [number, number, number],
      transaction: tx,
    }));
  }, [transactions]);

  return (
    <group>
      {particles.map((particle) => (
        <TransactionParticle
          key={particle.id}
          transaction={particle.transaction}
          position={particle.position}
        />
      ))}
    </group>
  );
}

interface Mempool3DVisualizerProps {
  transactions?: MempoolTransaction[];
  className?: string;
}

export default function Mempool3DVisualizer({
  transactions = [],
  className = '',
}: Mempool3DVisualizerProps) {
  const [simulatedTransactions, setSimulatedTransactions] = useState<MempoolTransaction[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTx: MempoolTransaction = {
        id: `tx-${Date.now()}`,
        value: Math.random() * 10000,
        direction: Math.random() > 0.5 ? 'buy' : 'sell',
        pair: ['WETH/USDC', 'WETH/LINK', 'USDC/LINK'][Math.floor(Math.random() * 3)],
        gasPrice: Math.random() * 100 + 20,
        timestamp: Date.now(),
      };

      setSimulatedTransactions((prev) => {
        const updated = [newTx, ...prev].slice(0, 50);
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const txList = transactions.length > 0 ? transactions : simulatedTransactions;

  return (
    <div className={`w-full h-[500px] bg-arb-dark rounded-lg overflow-hidden relative ${className}`}>
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-arb-accent font-mono text-lg">3D Mempool Visualizer</h3>
        <p className="text-gray-400 text-sm">Real-time pending transactions</p>
      </div>
      
      <div className="absolute top-4 right-4 z-10 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-arb-accent" />
          <span className="text-arb-accent text-xs">Buy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400 text-xs">Sell</span>
        </div>
      </div>

      <Canvas
        camera={{ position: [10, 10, 10], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00ff88" />
        
        <MempoolStream transactions={txList} />
        
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={0.5}
        />
        
        <gridHelper args={[40, 40, '#1a1a2e', '#1a1a2e']} />
      </Canvas>
    </div>
  );
}