import { FC, useState } from "react";
import "viem/window";
import { chains } from "./utils/chain";
import { Chain, hexToNumber, numberToHex } from "viem";

interface Propos {
  onChange(chain: number | undefined, address: `0x${string}` | undefined): void;
}

export const Network: FC<Propos> = ({ onChange }) => {
  const [chain, setChain] = useState<string | undefined>("0x343a");
  const [connectedChain, setConnectedChain] = useState<string | undefined>();
  const [walletAddress, setWalletAddress] = useState<string>();

  const accountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      // MetaMask is locked or the user has not connected any accounts.
      setChain(undefined);
      setWalletAddress(undefined);
      setConnectedChain(undefined);
      onChange(undefined, undefined);
      return;
    } else if (accounts[0] !== walletAddress) {
      // Reload your interface with accounts[0].
      setWalletAddress(accounts[0]);
    }
  };

  const chainChanged = (chainId: string) => {
    window.ethereum
      ?.request({ method: "eth_requestAccounts" })
      .then((accounts) => {
        if (!accounts || accounts.length === 0) {
          setChain(undefined);
          setWalletAddress(undefined);
          setConnectedChain(undefined);
          onChange(undefined, undefined);
          return;
        }

        setChain(chainId);
        setConnectedChain(chainId);
        setWalletAddress(accounts[0]);
        onChange(hexToNumber(chainId as `0x${string}`), accounts[0]);
      });
  };

  window.ethereum?.removeListener("accountsChanged", accountsChanged);
  window.ethereum?.removeListener("chainChanged", chainChanged);
  window.ethereum?.on("accountsChanged", accountsChanged);
  window.ethereum?.on("chainChanged", chainChanged);

  async function connect() {
    if (!chain) return;
    try {
      if (!window.ethereum) {
        alert("no provider");
        return;
      }

      await window.ethereum?.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain }],
      });

      const accounts = await window.ethereum?.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setChain(undefined);
        setWalletAddress(undefined);
        onChange(undefined, undefined);
        return;
      }

      setConnectedChain(chain);
      setWalletAddress(accounts[0]);

      onChange(parseInt(chain), accounts[0]);
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div>
      <div>
        <select
          onChange={(e) => {
            if (chains[parseInt(e.target.value)]) {
              setChain(e.target.value);
            } else {
              alert("No deploy on this chain");
            }
          }}
          value={chain}
        >
          {Object.entries(chains).map(([id, chain]: [string, Chain]) => {
            return (
              <option key={id} value={numberToHex(parseInt(id))}>
                {chain.name}
              </option>
            );
          })}
        </select>
        <button onClick={() => connect()}>connect</button>
      </div>
      {walletAddress ? (
        <div>
          Connected wallet: {walletAddress}
          <br />
        </div>
      ) : (
        <></>
      )}
      {connectedChain ? (
        <div>
          Connected chainId: {parseInt(connectedChain?.substring(2) ?? "0", 16)}
          <br />
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};
