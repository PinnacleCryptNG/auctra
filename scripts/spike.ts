// Spike helpers for the first live Monad Testnet USDC transfer. Reads .env.local.
//
//   npm run spike -- keygen
//   npm run spike -- verify-usdc
//   npm run spike -- balance --address 0xWALLET
//   npm run spike -- create-policy --user-id did:privy:... --wallet-id ID --to 0xDEST [--to 0xDEST2] --max 1
//   npm run spike -- verify-permission --wallet-id ID --address 0xWALLET --policy-id ID --to 0xDEST --max 1
//
// The policy is created OWNED BY THE USER (`owner: { user_id }`), never by
// Auctra's key. The user then attaches it in the app (onboarding → Approve,
// which calls Privy's addSigners). The transfer checks themselves live in
// tests/integration/privy-transfer.integration.test.ts. There is deliberately
// no command here that creates an Auctra-owned wallet or sends funds.

import { generateP256KeyPair } from "@privy-io/node";
import { formatEther, getAddress, isAddress, type Address } from "viem";
import { getMonadPublicClient } from "../lib/chain/monad";
import { MONAD_TESTNET_CHAIN_ID } from "../lib/network";
import { formatUsdcAmount, parseUsdcAmount, readUsdcBalance, verifyUsdcContract } from "../lib/usdc";
import { buildUserOwnedTransferPolicy, expectedPolicyFingerprint, verifyWalletPermission } from "../lib/wallet/policy";
import { createPrivyClient, privyAppConfigFromEnv } from "../lib/wallet/privy";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function flags(name: string): string[] {
  return process.argv.flatMap((arg, i) => (arg === `--${name}` && process.argv[i + 1] ? [process.argv[i + 1]] : []));
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

function limitsFromFlags() {
  const recipients = flags("to");
  if (recipients.length === 0) throw new Error("Missing --to");
  return { recipients, maxUnits: parseUsdcAmount(requiredFlag("max")) };
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "keygen": {
      const { publicKey, privateKey } = await generateP256KeyPair();
      console.log("Auctra authorization key: signs Auctra's API requests to Privy. NOT a wallet key.");
      console.log("Put the private key in .env.local only; never commit it.\n");
      console.log(`PRIVY_AUTHORIZATION_PRIVATE_KEY=${privateKey}`);
      console.log(`# Public key. Register it in the Privy dashboard as a key quorum; its ID is PRIVY_SIGNER_ID:\n# ${publicKey}`);
      return;
    }

    case "verify-usdc": {
      const client = getMonadPublicClient();
      const chainId = await client.getChainId();
      if (chainId !== MONAD_TESTNET_CHAIN_ID) throw new Error(`RPC reports chain ${chainId}, expected ${MONAD_TESTNET_CHAIN_ID}`);
      console.log(await verifyUsdcContract(client));
      return;
    }

    case "balance": {
      const client = getMonadPublicClient();
      const address = requiredAddress("address");
      const [mon, usdc] = await Promise.all([client.getBalance({ address }), readUsdcBalance(client, address)]);
      console.log(`MON  ${formatEther(mon)}\nUSDC ${formatUsdcAmount(usdc)}`);
      return;
    }

    case "create-policy": {
      const limits = limitsFromFlags();
      const fingerprint = expectedPolicyFingerprint(limits);
      const policy = await createPrivyClient(privyAppConfigFromEnv())
        .policies()
        .create({
          ...buildUserOwnedTransferPolicy({ name: `auctra-spike-${fingerprint.slice(0, 12)}`, privyUserId: requiredFlag("user-id"), ...limits }),
          idempotency_key: `auctra-policy:${requiredFlag("wallet-id")}:${fingerprint}`
        });
      console.log(`policy_id=${policy.id}\nowner_id=${policy.owner_id}\nrules=${policy.rules.length}`);
      return;
    }

    case "verify-permission": {
      const client = createPrivyClient(privyAppConfigFromEnv());
      const signerId = process.env.PRIVY_SIGNER_ID;
      if (!signerId) throw new Error("PRIVY_SIGNER_ID is not set");
      const walletId = requiredFlag("wallet-id");
      const policyId = requiredFlag("policy-id");
      const [wallet, policy] = await Promise.all([client.wallets().get(walletId), client.policies().get(policyId)]);
      const result = verifyWalletPermission({
        wallet,
        policy,
        expected: { privyWalletId: walletId, address: requiredAddress("address"), signerId, policyId, limits: limitsFromFlags() }
      });
      console.log(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    default:
      console.error("Usage: npm run spike -- <keygen|verify-usdc|balance|create-policy|verify-permission> [flags]");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  // Name and message only: never dump request objects that could carry headers.
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Spike command failed.");
  process.exitCode = 1;
});
