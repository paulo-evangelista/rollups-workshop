import { FC } from "react";
import { useState } from "react";

import { Network } from "./Network";
import { Inspect } from "./Inspect";
import { Input } from "./Input";
import { Reports } from "./Reports";
import type { Hex } from "viem";
import { Outputs } from "./Outputs";

type NetworkProp = typeof Network extends FC<infer P> ? P : never;

const App: FC = () => {
  const [appAddress, setAppAddress] = useState<Hex | undefined>(
    "0xa966c86F18D463C90DA64940053B411Be671E77E",
  );
  const [nodeAddress, setNodeAddress] = useState<string | undefined>(
    "http://127.0.0.1:6751",
  );

  const [chainId, setChainId] = useState<number>();

  const connect: NetworkProp["onChange"] = (chain) => {
    setChainId(chain);
  };

  const handleAddres = (value: string) => {
    setAppAddress(value as Hex);
  };

  return (
    <div>
      <Network onChange={connect} />
      {chainId ? (
        <>
          <br />
          <div>
            Dapp Address:{" "}
            <input
              type="text"
              value={appAddress}
              onChange={(e) => {
                handleAddres(e.target.value);
              }}
            />
          </div>
          <br />
          <div>
            Node Address:{" "}
            <input
              type="text"
              value={nodeAddress}
              onChange={(e) => {
                setNodeAddress(e.target.value);
              }}
            />
            <br />
          </div>
          {appAddress && nodeAddress ? (
            <>
              <h2>Inspect</h2>
              <Inspect
                chain={chainId}
                appAddress={appAddress}
                nodeAddress={nodeAddress}
              />
              <h2>Input</h2>
              <Input
                chain={chainId}
                appAddress={appAddress}
                nodeAddress={nodeAddress}
              />
              <h2>Reports</h2>
              <Reports
                chain={chainId}
                appAddress={appAddress}
                nodeAddress={nodeAddress}
              />
              <h2>Outputs</h2>
              <Outputs
                chain={chainId}
                appAddress={appAddress}
                nodeAddress={nodeAddress}
              />
            </>
          ) : (
            <></>
          )}
        </>
      ) : (
        <></>
      )}
    </div>
  );
};

export default App;
