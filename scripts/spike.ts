// Spike: prove Privy server-side signing of a USDC transfer on Monad Testnet.
//
//   npm run spike -- keygen
//   npm run spike -- verify-usdc
//   npm run spike -- create-policy --to 0xDEST --max 25
//   npm run spike -- create-wallet [--policy POLICY_ID]
//   npm run spike -- balance --address 0xWALLET
//   npm run spike -- send --wallet-id ID --from 0xWALLET --to 0xDEST --amount 1
//
// Reads .env.local. The wallet created here is owned by Auctra's authorization
// key, standing in for a user wallet that has added that key as a session signer:
// the server signing path is the same.

import { createPrivateKey, createPublicKey, randomUUID } from "node:crypto";
import { generateP256KeyPair } from "@privy-io/node";
import { formatEther, getAddress, isAddress, type Address } from "viem";
import { explorerTxUrl, getMonadPublicClient } from "../lib/chain/monad";
import { MONAD_TESTNET_CHAIN_ID } from "../lib/network";
import { formatUsdcAmount, parseUsdcAmount, readUsdcBalance, verifyUsdcContract } from "../lib/usdc";
import { executeUsdcTransfer } from "../lib/wallet/executor";
import { buildUsdcTransferPolicy, createPrivyClient, createPrivySigner, privyConfigFromEnv } from "../lib/wallet/privy";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredFlag(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function requiredAddress(name: string): Address {
  const value = requiredFlag(name);
  if (!isAddress(value)) throw new Error(`--${name} is not a valid address`);
  return getAddress(value);
}

function publicKeyFromPrivate(privateKeyBase64: string) {
  const privateKey = createPrivateKey({ key: Buffer.from(privateKeyBase64, "base64"), format: "der", type: "pkcs8" });
  return createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "keygen": {
      const { publicKey, privateKey } = await generateP256KeyPair();
      console.log("Auctra authorization key (app-level signer, NOT a user wallet key).");
      console.log("Put the private key in .env.local only; never commit it.\n");
      console.log(`PRIVY_AUTHORIZATION_PRIVATE_KEY=${privateKey}`);
      console.log(`# public key (register in Privy dashboard as a key quorum / session signer): ${publicKey}`);
      return;
    }

    case "verify-usdc": {
      const client = getMonadPublicClient();
      const chainId = await client.getChainId();
      if (chainId !== MONAD_TESTNET_CHAIN_ID) throw new Error(`RPC reports chain ${chainId}, expected ${MONAD_TESTNET_CHAIN_ID}`);
      console.log(await verifyUsdcContract(client));
      return;
    }

    case "create-policy": {
      const config = privyConfigFromEnv();
      const policy = await createPrivyClient(config).policies().create({
        ...buildUsdcTransferPolicy({
          name: "auctra-spike-usdc-transfer",
          destinations: [requiredAddress("to")],
          maxUnits: parseUsdcAmount(requiredFlag("max"))
        }),
        owner: { public_key: publicKeyFromPrivate(config.authorizationPrivateKey) }
      });
      console.log(`policy_id=${policy.id}`);
      return;
    }

    case "create-wallet": {
      const config = privyConfigFromEnv();
      const policyId = flag("policy");
      const wallet = await createPrivyClient(config).wallets().create({
        chain_type: "ethereum",
        owner: { public_key: publicKeyFromPrivate(config.authorizationPrivateKey) },
        ...(policyId ? { policy_ids: [policyId] } : {})
      });
      console.log(`wallet_id=${wallet.id}\naddress=${wallet.address}`);
      console.log("Fund it with testnet MON (gas) and testnet USDC before sending.");
      return;
    }

    case "balance": {
      const client = getMonadPublicClient();
      const address = requiredAddress("address");
      const [mon, usdc] = await Promise.all([client.getBalance({ address }), readUsdcBalance(client, address)]);
      console.log(`MON  ${formatEther(mon)}\nUSDC ${formatUsdcAmount(usdc)}`);
      return;
    }

    case "send": {
      const client = getMonadPublicClient();
      await verifyUsdcContract(client);

      const idempotencyKey = flag("idempotency-key") ?? `spike:${randomUUID()}`;
      const { txHash } = await executeUsdcTransfer(
        {
          walletId: requiredFlag("wallet-id"),
          from: requiredFlag("from"),
          to: requiredFlag("to"),
          asset: "USDC",
          amount: requiredFlag("amount"),
          chainId: MONAD_TESTNET_CHAIN_ID,
          idempotencyKey
        },
        {
          signer: createPrivySigner(privyConfigFromEnv()),
          readUsdcBalance: (owner) => readUsdcBalance(client, owner)
        }
      );

      console.log(`idempotency_key=${idempotencyKey}\ntx_hash=${txHash}\n${explorerTxUrl(txHash)}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log(`status=${receipt.status} block=${receipt.blockNumber}`);
      if (receipt.status !== "success") process.exitCode = 1;
      return;
    }

    default:
      console.error("Usage: npm run spike -- <keygen|verify-usdc|create-policy|create-wallet|balance|send> [flags]");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
  process.exitCode = 1;
});
