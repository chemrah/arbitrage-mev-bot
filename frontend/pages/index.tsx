import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import WalletConnector from '../components/WalletConnector';

const Mempool3DVisualizer = dynamic(
  () => import('../components/Mempool3DVisualizer'),
  { ssr: false }
);
const LiquidityBubbleMap = dynamic(
  () => import('../components/LiquidityBubbleMap'),
  { ssr: false }
);
const ArbDashboard = dynamic(
  () => import('../components/ArbDashboard'),
  { ssr: false }
);

function getLibrary(provider: any) {
  return new Web3Provider(provider);
}

export default function Home() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <div className="min-h-screen bg-arb-dark text-white">
        <Head>
          <title>Arbitrage Bot - High-Frequency Trading System</title>
          <meta name="description" content="Production-grade arbitrage bot with real-time mempool monitoring" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <header className="bg-arb-panel border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-arb-accent rounded-lg flex items-center justify-center">
                  <span className="text-arb-dark font-bold text-sm">A</span>
                </div>
                <div>
                  <h1 className="text-arb-accent font-mono text-lg font-bold">
                    Arbitrage Bot
                  </h1>
                  <p className="text-gray-400 text-xs">High-Frequency Trading System</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-green-400">Live</span>
                </div>
                <WalletConnector />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <section className="mb-8">
            <Mempool3DVisualizer />
          </section>

          <section className="mb-8">
            <LiquidityBubbleMap />
          </section>

          <section className="mb-8">
            <ArbDashboard />
          </section>
        </main>

        <footer className="bg-arb-panel border-t border-gray-800 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-400 text-sm">
                <p>Arbitrage Bot v0.1.0 - Production Ready</p>
              </div>
              <div className="flex items-center gap-4 text-gray-400 text-sm">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  System Operational
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Web3ReactProvider>
  );
}
