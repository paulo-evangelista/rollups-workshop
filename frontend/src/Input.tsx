import React, { useState, useEffect } from "react";

import { toHex } from "viem";

import { chains, getClient, getWalletClient } from "./utils/chain";
import { INodeComponentProps } from "./utils/models";

export const Input: React.FC<INodeComponentProps> = (
  props: INodeComponentProps,
) => {
  const [chainId, setChainId] = useState<number>();

  useEffect(() => {
    if (!props.chain) {
      return;
    }
    setChainId(props.chain);
  }, [props.chain]);

  const addInput = async (str: string) => {
    if (chainId && props.appAddress) {
      const client = await getClient(chainId);
      const walletClient = await getWalletClient(chainId);

      if (!client || !walletClient) return;

      const [address] = await walletClient.requestAddresses();
      if (!address) return;
      try {
        let payload = toHex(str);
        if (hexInput) {
          payload = str as `0x${string}`;
        }

        const txHash = await walletClient.addInput({
          application: props.appAddress,
          payload,
          account: address,
          chain: chains[chainId],
        });

        await client.waitForTransactionReceipt({ hash: txHash });
      } catch (e) {
        console.log(e);
      }
    }
  };

  const [input, setInput] = useState<string>("");
  const [hexInput, setHexInput] = useState<boolean>(false);

  return (
    <div>
      <div>
        Send Input <br />
        Input:{" "}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <input
          type="checkbox"
          checked={hexInput}
          onChange={() => setHexInput(!hexInput)}
        />
        <span>Raw Hex </span>
        <button onClick={() => addInput(input)} disabled={!chainId}>
          Send
        </button>
        <br />
        <br />
      </div>
    </div>
  );
};
