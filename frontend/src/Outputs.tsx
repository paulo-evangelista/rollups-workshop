import React, { useEffect, useState } from "react";
import {
  Address,
  BaseError,
  decodeAbiParameters,
  formatEther,
  fromHex,
  Hex,
  isHex,
  parseAbiParameters,
  size,
  slice,
} from "viem";
import { chains, getClient, getWalletClient, getL2Client } from "./utils/chain";
import { INodeComponentProps } from "./utils/models";
import { Output } from "@cartesi/viem";

type RpcFilter = {
  limit?: number;
  offset?: number;
  epochIndex?: bigint;
  inputIndex?: bigint;
  outputType?: Hex;
  voucherAddress?: Address;
};

function inferVoucherPayload(voucherPayload: `0x${string}`): string {
  const selector =
    voucherPayload && size(voucherPayload) > 4
      ? slice(voucherPayload, 0, 4)
      : "";
  const data =
    voucherPayload && size(voucherPayload) > 4
      ? slice(voucherPayload, 4, voucherPayload.length)
      : "0x";

  if (size(data) > 0) {
    switch (selector.toLowerCase()) {
      case "0xa9059cbb": {
        // erc20 transfer;
        const decode = decodeAbiParameters(
          parseAbiParameters("address receiver, uint256 amount"),
          data,
        );
        return `Erc20 Transfer - Amount: ${decode[1]} - Address: ${decode[0]}`;
      }
      default: {
        return voucherPayload + " (hex)";
      }
    }
  }
  return "(empty)";
}

async function getOutputs(
  appAddress: string,
  nodeAddress: string,
  filter?: RpcFilter,
) {
  if (!nodeAddress) return [];
  const client = await getL2Client(nodeAddress + "/rpc");
  if (!client) return [];
  const outputResponse = await client.listOutputs({
    ...filter,
    application: appAddress,
  });
  return outputResponse.data;
}

async function getLastAcceptedEpoch(appAddress: string, nodeAddress: string) {
  if (!nodeAddress) return BigInt(0);
  const client = await getL2Client(nodeAddress + "/rpc");
  if (!client) return BigInt(0);
  try {
    const outputResponse = await client.getLastAcceptedEpochIndex({
      application: appAddress,
    });
    return outputResponse;
  } catch (error) {
    console.log(error.details);
    return BigInt(0);
  }
}

export const Outputs: React.FC<INodeComponentProps> = (
  props: INodeComponentProps,
) => {
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [lastAcceptedEpoch, setLastAcceptedEpoch] = useState<bigint>(BigInt(0));
  const [outputMsg, setOutputMsg] = useState<string>();
  const [limit, setLimit] = useState<number>();
  const [offset, setOffset] = useState<number>();
  const [outputType, setOutputType] = useState<string>();
  const [epochIndex, setEpochIndex] = useState<number>();
  const [inputIndex, setInputIndex] = useState<number>();
  const [voucherAddress, setVoucherAddress] = useState<string>();
  useEffect(() => {
    setFetching(true);
    setOutputMsg(undefined);
    getOutputs(props.appAddress, props.nodeAddress)
      .then((out) => setOutputs(out))
      .finally(() => setFetching(false));
    getLastAcceptedEpoch(props.appAddress, props.nodeAddress)
      .then((epoch) => setLastAcceptedEpoch(epoch))
      .catch((e) => console.warn(`Error getting epoch: ${e}`));
  }, [props]);

  async function reloadOutputs() {
    if (!props.chain) {
      setError("No connected chain");
      return;
    }
    setFetching(true);
    setOutputMsg(undefined);
    reloadOutputProperties();
    getOutputs(props.appAddress, props.nodeAddress, {
      limit,
      offset,
      epochIndex: epochIndex ? BigInt(epochIndex) : undefined,
      inputIndex: inputIndex ? BigInt(inputIndex) : undefined,
      outputType: outputType ? (outputType as Hex) : undefined,
      voucherAddress: voucherAddress ? (voucherAddress as Address) : undefined,
    })
      .then((out) => setOutputs(out))
      .catch((e) => console.warn(`Error getting epoch: ${e}`))
      .finally(() => setFetching(false));
  }

  async function reloadOutputProperties() {
    getLastAcceptedEpoch(props.appAddress, props.nodeAddress)
      .then((epoch) => setLastAcceptedEpoch(epoch))
      .catch((e) => console.warn(`Error getting epoch: ${e}`));
  }

  if (fetching) return <p>Loading...</p>;
  if (error) return <p>Oh no... {error}</p>;

  if (!outputs) return <p>No outputs</p>;

  async function validateOutput(output: Output) {
    setOutputMsg(undefined);
    if (props.chain && props.appAddress) {
      const client = await getClient(props.chain);

      if (!client) return;

      try {
        if (
          await client.validateOutput({
            output: output,
            application: props.appAddress,
          })
        ) {
          setOutputMsg("Output is Valid!");
        } else {
          setOutputMsg("Output is Invalid!");
        }
      } catch (e) {
        console.error(e);
        if (e instanceof BaseError) {
          setOutputMsg(e.walk().message);
        }
      }
    }
  }

  async function executeOutput(output: Output) {
    setOutputMsg(undefined);
    if (props.chain && props.appAddress) {
      const client = await getClient(props.chain);
      const walletClient = await getWalletClient(props.chain);

      if (!client || !walletClient) return;

      const [address] = await walletClient.requestAddresses();
      if (!address) return;

      try {
        if (
          await walletClient.executeOutput({
            application: props.appAddress,
            output: output,
            account: address,
            chain: chains[props.chain],
          })
        ) {
          setOutputMsg("Output executed!");
        } else {
          setOutputMsg("Output not executed!");
        }
      } catch (e) {
        console.error(e);
        if (e instanceof BaseError) {
          setOutputMsg(e.walk().message);
        }
      }
    }
  }

  function renderActionButton(output: Output) {
    const decodedData = output.decodedData as Record<string, unknown>;
    const type: string =
      decodedData && decodedData.type ? (decodedData.type as string) : "";
    let alreadyExecuted: boolean | undefined = undefined;
    const claimAccepted = output.epochIndex <= lastAcceptedEpoch;
    switch (type.toLowerCase()) {
      case "voucher":
      case "delegatecallvoucher":
        alreadyExecuted = output.executionTransactionHash != null;
        return (
          <button
            disabled={alreadyExecuted || !claimAccepted}
            onClick={() => executeOutput(output)}
          >
            {claimAccepted
              ? alreadyExecuted
                ? "Already Executed"
                : "Execute"
              : "Not Ready"}
          </button>
        );
      case "notice":
        return (
          <button
            disabled={!claimAccepted}
            onClick={() => validateOutput(output)}
          >
            {claimAccepted ? "Validate" : "Not Ready"}
          </button>
        );
    }
    return null;
  }

  const decoder = new TextDecoder("utf8", { fatal: true });

  return (
    <div>
      <button onClick={() => setShowFilter(!showFilter)}>Toggle Filter</button>
      <div hidden={!showFilter}>
        Limit:{" "}
        <input
          type="number"
          value={limit || ""}
          onChange={(e) => setLimit(parseInt(e.target.value))}
        />
        <br />
        Offset:{" "}
        <input
          type="number"
          value={offset || ""}
          onChange={(e) => setOffset(parseInt(e.target.value))}
        />
        <br />
        Type:{" "}
        <input
          type="text"
          value={outputType || ""}
          onChange={(e) => setOutputType(e.target.value)}
        />
        <br />
        Epoch:{" "}
        <input
          type="number"
          value={epochIndex || ""}
          onChange={(e) => setEpochIndex(parseInt(e.target.value))}
        />
        <br />
        Input:{" "}
        <input
          type="text"
          value={inputIndex || ""}
          onChange={(e) => setInputIndex(parseInt(e.target.value))}
        />
        <br />
        Voucher address:{" "}
        <input
          type="text"
          value={voucherAddress || ""}
          onChange={(e) => setVoucherAddress(e.target.value)}
        />
      </div>
      <br />
      <button onClick={() => reloadOutputs()}>Reload</button>
      <br />
      <br />
      <span className="text-bold">Message:</span> {outputMsg}
      <br />
      <br />
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Input Id</th>
            <th>Output Index</th>
            <th>Type</th>
            <th>Value</th>
            <th>Destination</th>
            <th>Actions</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {outputs.length === 0 && (
            <tr>
              <td colSpan={4}>no outputs</td>
            </tr>
          )}
          {outputs.map((n, index) => {
            const decodedData = n.decodedData as Record<string, unknown>;
            const type: string =
              decodedData && decodedData.type
                ? (decodedData.type as string)
                : "";
            let value = "";
            let destination = "";
            let payload: string =
              decodedData && decodedData.payload
                ? (decodedData.payload as string)
                : "";
            switch (type.toLowerCase()) {
              case "voucher":
                payload = inferVoucherPayload(payload as `0x${string}`);
                value =
                  decodedData && decodedData.value
                    ? formatEther(
                        fromHex(decodedData.value as `0x${string}`, "bigint"),
                      )
                    : "";
                destination =
                  decodedData && decodedData.destination
                    ? (decodedData.destination as string)
                    : "";
                break;
              case "notice":
                try {
                  if (!isHex(payload)) throw new Error("not hex");
                  payload = decoder.decode(fromHex(payload, "bytes"));
                } catch {
                  payload = "(hex) " + payload;
                }
                break;
              default:
                payload = "unknown";
            }
            return (
              <tr key={`${index}`}>
                <td>{n.updatedAt.toLocaleString()}</td>
                <td>{n.inputIndex}</td>
                <td>{n.index}</td>
                <td>{type}</td>
                {type.toLowerCase() === "voucher" ? (
                  <td>{value}</td>
                ) : (
                  <td></td>
                )}
                {type.toLowerCase() === "voucher" ? (
                  <td>{destination}</td>
                ) : (
                  <td></td>
                )}
                <td>{renderActionButton(n)}</td>
                <td title={payload}>
                  {payload.length > 80 ? `${payload.slice(0, 80)}...` : payload}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
