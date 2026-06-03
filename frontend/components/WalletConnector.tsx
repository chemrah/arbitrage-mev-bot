'use client';

import React, { useState, useCallback } from 'react';
import { MetaMaskConnector } from '@web3-react/injected-connector';
import { useWeb3React } from '@web3-react/core';
import { createWeb3ReactRoot } from '@web3-react/core';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import { Wallet, Link, LogOut, AlertCircle } from 'lucide-react';

const injected = new MetaMaskConnector({
  supportedChainIds: [1, 5, 11155111], // Mainnet, Goerli, Sepolia
});

export function useWallet() {
  const { active, account, library, activate, deactivate } = useWeb3React();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await activate(injected);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, [activate]);

  const disconnect = useCallback(() => {
    deactivate();
    setError(null);
  }, [deactivate]);

  const getSigner = useCallback(() => {
    if (library) {
      return library.getSigner();
    }
    return null;
  }, [library]);

  return {
    isConnected: active,
    account,
    connect,
    disconnect,
    getSigner,
    error,
    connecting,
  };
}

interface WalletConnectorProps {
  className?: string;
}

export default function WalletConnector({ className = '' }: WalletConnectorProps) {
  const { isConnected, account, connect, disconnect, error, connecting } = useWallet();
  const [showDetails, setShowDetails] = useState(false);

  const formatAddress = (address: string | null | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <div className="flex items-center gap-2 bg-arb-panel rounded-lg px-4 py-2 border border-arb-accent/30">
            <div className="w-2 h-2 rounded-full bg-arb-accent animate-pulse" />
            <span className="text-arb-accent font-mono text-sm">
              {formatAddress(account)}
            </span>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Link size={16} />
            </button>
            <button
              onClick={disconnect}
              className="text-red-400 hover:text-red-300 transition-colors"
              title="Disconnect"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="flex items-center gap-2 bg-arb-accent text-arb-dark px-4 py-2 rounded-lg font-semibold hover:bg-arb-accent-dim transition-colors disabled:opacity-50"
          >
            <Wallet size={18} />
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>

      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-900/90 border border-red-500 rounded-lg p-3 flex items-start gap-2 max-w-xs z-50">
          <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {showDetails && isConnected && (
        <div className="absolute top-full mt-2 right-0 bg-arb-panel border border-arb-accent/30 rounded-lg p-4 w-80 z-50">
          <h4 className="text-arb-accent font-semibold mb-3">Wallet Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Address</span>
              <span className="font-mono text-xs text-gray-300">{formatAddress(account)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network</span>
              <span className="text-arb-accent">Ethereum Mainnet</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-green-400">Connected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}