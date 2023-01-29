/**
 * @jest-environment jsdom
 */

const {TextEncoder, TextDecoder} = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import {EdgeDBVersion, getEdgeDBVersion} from "./testbase";

// @ts-ignore
if (typeof fetch === "undefined") {
  // Pre 17.5 NodeJS environment.
  // @ts-ignore
  globalThis.fetch = require("node-fetch"); // tslint:disable-line
}

const nodeVersion = parseInt(process.version.slice(1).split(".")[0], 10);

if (nodeVersion >= 15) {
  // @ts-ignore
  crypto.subtle = require("crypto").webcrypto.subtle;
}

let version: EdgeDBVersion;
beforeAll(async () => {
  version = await getEdgeDBVersion();
  for (const nodeModule of [
    "assert",
    "async_hooks",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "dns",
    "domain",
    "events",
    "fs",
    "http",
    "http2",
    "https",
    "inspector",
    "module",
    "net",
    "os",
    "path",
    "perf_hooks",
    "process",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "string_decoder",
    "timers",
    "tls",
    "trace_events",
    "tty",
    "url",
    "util",
    "v8",
    "vm",
    "worker_threads",
    "zlib"
  ]) {
    jest.mock(nodeModule, () => {
      throw new Error(`Cannot use node module '${nodeModule}' in browser`);
    });
  }
});

import {
  createClient,
  createHttpClient,
  EdgeDBError
} from "../src/index.browser";
import {FetchConnection} from "../src/fetchConn";
import {ConnectOptions} from "../src/baseClient";

const brokenConnectOpts = JSON.parse(
  process.env._JEST_EDGEDB_CONNECT_CONFIG || ""
);

const connectOpts = {
  ...brokenConnectOpts,
  tlsCAFile: undefined,
  tlsSecurity: "insecure"
};

// Skip tests on node < 15, since webcrypto api not available
if (nodeVersion >= 15) {
  test("createClient fails", () => {
    if (version!.major < 2) return;
    expect(() => createClient()).toThrowError(EdgeDBError);
  });

  test("createHttpClient no options", async () => {
    if (version!.major < 2) return;
    const client = createHttpClient();

    await expect(client.ensureConnected()).rejects.toThrowError(
      /no connection options specified/
    );
  });

  describe("tlsSecurty handling", () => {
    const BASE_OPTS: Partial<ConnectOptions> = {
      host: "some.host.tld",
      port: 5656,
      database: "sample_database"
    };

    test("defaults to HTTPS when tlsSecurity is undefined", async () => {
      if (version!.major < 2) return;
      const client = createHttpClient(BASE_OPTS);

      const expectedAddr = `https://${BASE_OPTS.host}:${BASE_OPTS.port}/db/${BASE_OPTS.database}`;
      const observedAddr = (
        (await client["pool"].getNewConnection()) as FetchConnection
      )["addr"];

      expect(observedAddr).toBe(expectedAddr);
      await expect(client.ensureConnected()).resolves.toBe(client);
    });

    test("uses HTTP when tlsSecurity is 'insecure'", async () => {
      if (version!.major < 2) return;
      const client = createHttpClient({
        ...BASE_OPTS,
        tlsSecurity: "insecure"
      });

      const expectedAddr = `http://${BASE_OPTS.host}:${BASE_OPTS.port}/db/${BASE_OPTS.database}`;
      const observedAddr = (
        (await client["pool"].getNewConnection()) as FetchConnection
      )["addr"];

      expect(observedAddr).toBe(expectedAddr);
      await expect(client.ensureConnected()).resolves.toBe(client);
    });

    for (const tlsSecurity of ["strict", "no_host_verification"] as const) {
      test(`uses HTTPS when tlsSecurity is '${tlsSecurity}'`, async () => {
        if (version!.major < 2) return;
        const client = createHttpClient({
          ...BASE_OPTS,
          tlsSecurity
        });

        const expectedAddr = `https://${BASE_OPTS.host}:${BASE_OPTS.port}/db/${BASE_OPTS.database}`;
        const observedAddr = (
          (await client["pool"].getNewConnection()) as FetchConnection
        )["addr"];

        expect(observedAddr).toBe(expectedAddr);
        await expect(client.ensureConnected()).resolves.toBe(client);
      });
    }
  });

  test("basic queries", async () => {
    if (version!.major < 2) return;
    const client = createHttpClient(connectOpts);

    expect(
      await client.querySingle(`select 'Querying from the ' ++ <str>$env`, {
        env: "browser"
      })
    ).toEqual("Querying from the browser");
  });
} else {
  test.skip("skipping browser test", () => {
    // dummy test to satisfy jest
  });
}
