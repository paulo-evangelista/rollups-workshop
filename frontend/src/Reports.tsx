import React, { useEffect, useState } from "react";
import { fromHex, isHex } from "viem";
import { Report } from "@cartesi/viem";
import { getL2Client } from "./utils/chain";
import { INodeComponentProps } from "./utils/models";

type RpcFilter = {
  limit?: number;
  offset?: number;
  epochIndex?: bigint;
  inputIndex?: bigint;
};

async function getReports(
  appAddress: string,
  nodeAddress: string,
  filter?: RpcFilter,
) {
  if (!nodeAddress) return [];
  const client = await getL2Client(nodeAddress + "/rpc");
  if (!client) return [];
  const reportResponse = await client.listReports({
    ...filter,
    application: appAddress,
  });
  return reportResponse.data;
}

export const Reports: React.FC<INodeComponentProps> = (
  props: INodeComponentProps,
) => {
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [limit, setLimit] = useState<number>();
  const [offset, setOffset] = useState<number>();
  const [epochIndex, setEpochIndex] = useState<number>();
  const [inputIndex, setInputIndex] = useState<number>();

  useEffect(() => {
    setFetching(true);
    getReports(props.appAddress, props.nodeAddress)
      .then((out) => setReports(out))
      .finally(() => setFetching(false));
  }, [props]);

  async function loadReports() {
    if (!props.chain) {
      setError("No connected chain");
      return;
    }
    setFetching(true);
    const out = await getReports(props.appAddress, props.nodeAddress, {
      limit,
      offset,
      epochIndex: epochIndex ? BigInt(epochIndex) : undefined,
      inputIndex: inputIndex ? BigInt(inputIndex) : undefined,
    });
    setReports(out);
    setFetching(false);
  }

  if (fetching) return <p>Loading...</p>;
  if (error) return <p>Oh no... {error}</p>;

  if (!reports) return <p>No reports</p>;

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
      </div>
      <br />
      <button onClick={() => loadReports()}>Reload</button>
      <br />
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Input Id</th>
            <th>Report Index</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 && (
            <tr>
              <td colSpan={4}>no reports</td>
            </tr>
          )}
          {reports.map((n, index) => {
            let payload: string = n.rawData && n.rawData ? n.rawData : "";
            try {
              if (!isHex(payload)) throw new Error("not hex");
              payload = decoder.decode(fromHex(payload, "bytes"));
            } catch {
              payload = payload + " (hex)";
            }
            return (
              <tr key={`${index}`}>
                <td>{n.updatedAt.toLocaleString()}</td>
                <td>{n.inputIndex}</td>
                <td>{n.index}</td>
                <td>{payload}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
