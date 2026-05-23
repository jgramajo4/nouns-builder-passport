// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Script, console2 } from "forge-std/Script.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import { PropUpdateResolver } from "../src/PropUpdateResolver.sol";
import { NounHolderResolver } from "../src/NounHolderResolver.sol";
import { NounsPassportResolver } from "../src/NounsPassportResolver.sol";
import { IPropdates } from "../src/interfaces/IPropdates.sol";
import { INounsToken } from "../src/interfaces/INounsToken.sol";

/// @title DeployPassport
/// @notice Deploys all three resolver contracts, registers the three EAS schemas,
///         and wires up the post-deploy configuration in the correct order.
///
/// Run on mainnet:
///   forge script script/DeployPassport.s.sol \
///     --rpc-url $MAINNET_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify
///
/// Run on Sepolia for testing:
///   forge script script/DeployPassport.s.sol \
///     --rpc-url $SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract DeployPassport is Script {
    // -------------------------------------------------------------------------
    // Mainnet addresses (do not change)
    // -------------------------------------------------------------------------

    /// @dev EAS v0.26 — mainnet addresses (Sepolia overridden in run() via block.chainid)
    address constant EAS_MAINNET             = 0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587;
    address constant SCHEMA_REGISTRY_MAINNET = 0xA7b39296258348C78294F95B872b282326A97BDF;

    address constant EAS_SEPOLIA             = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;
    address constant SCHEMA_REGISTRY_SEPOLIA = 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0;

    /// @dev Nouns ecosystem contracts (mainnet only — Sepolia uses placeholder EOAs)
    address constant PROPDATES_MAINNET   = 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4;
    address constant NOUNS_TOKEN_MAINNET = 0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03;

    /// @dev On Sepolia these contracts don't exist — resolvers deploy but won't
    ///      enforce Propdates/NounsToken rules. For integration testing only.
    address constant PROPDATES_SEPOLIA   = address(0);
    address constant NOUNS_TOKEN_SEPOLIA = address(0);

    // -------------------------------------------------------------------------
    // Schema strings — must match exactly what is encoded in attestations
    // -------------------------------------------------------------------------

    /// @dev Schema 1 — milestone attestation (builder signs)
    string constant SCHEMA_1 =
        "uint256 propId,string milestoneTitle,string evidenceURI,bool isFinal,bytes32 propdateTxHash";

    /// @dev Schema 2 — peer verification (Noun holder signs)
    string constant SCHEMA_2 =
        "bytes32 milestoneUID,uint256 propId,bool verified,string comment";

    /// @dev Schema 3 — Builder Passport (auto-issued by NounsPassportResolver)
    string constant SCHEMA_3 =
        "address builder,uint256 totalProps,uint256 completedProps,uint256 totalMilestones,"
        "uint256 peerVerifications,uint256 avgDaysBetweenUpdates,uint256 passportVersion";

    // -------------------------------------------------------------------------
    // Script
    // -------------------------------------------------------------------------

    function run() external {
        vm.startBroadcast();

        bool isSepolia = block.chainid == 11155111;
        address easAddr        = isSepolia ? EAS_SEPOLIA             : EAS_MAINNET;
        address registryAddr   = isSepolia ? SCHEMA_REGISTRY_SEPOLIA : SCHEMA_REGISTRY_MAINNET;
        address propdatesAddr  = isSepolia ? PROPDATES_SEPOLIA       : PROPDATES_MAINNET;
        address nounsTokenAddr = isSepolia ? NOUNS_TOKEN_SEPOLIA     : NOUNS_TOKEN_MAINNET;

        ISchemaRegistry registry = ISchemaRegistry(registryAddr);
        IEAS eas = IEAS(easAddr);

        // ── Step 1: Deploy NounsPassportResolver first (Schema 1 resolver) ──
        // It needs to exist before Schema 1 is registered so its address can
        // be set as the resolver.
        console2.log("Deploying NounsPassportResolver...");
        NounsPassportResolver passportResolver = new NounsPassportResolver(
            eas,
            IPropdates(propdatesAddr)
        );
        console2.log("NounsPassportResolver:", address(passportResolver));

        // ── Step 2: Deploy PropUpdateResolver ──
        // A lighter Schema 1 resolver for anyone who wants to attest milestones
        // without triggering passport logic (e.g. other clients). In practice,
        // NounsPassportResolver IS the Schema 1 resolver — PropUpdateResolver
        // is kept as a reference/fallback.
        console2.log("Deploying PropUpdateResolver...");
        PropUpdateResolver propUpdateResolver = new PropUpdateResolver(
            eas,
            IPropdates(propdatesAddr)
        );
        console2.log("PropUpdateResolver:", address(propUpdateResolver));

        // ── Step 3: Deploy NounHolderResolver (Schema 2 resolver) ──
        console2.log("Deploying NounHolderResolver...");
        NounHolderResolver nounHolderResolver = new NounHolderResolver(
            eas,
            INounsToken(nounsTokenAddr)
        );
        console2.log("NounHolderResolver:", address(nounHolderResolver));

        // ── Step 4: Register Schema 1 with NounsPassportResolver as resolver ──
        // Non-revocable (mirrors Propdates isCompleted immutability)
        console2.log("Registering Schema 1...");
        bytes32 schema1UID = registry.register(
            SCHEMA_1,
            passportResolver,    // NounsPassportResolver handles validation + passport
            false                // not revocable
        );
        console2.log("Schema 1 UID:");
        console2.logBytes32(schema1UID);

        // ── Step 5: Register Schema 2 with NounHolderResolver as resolver ──
        // Revocable — Nouners can change their view
        console2.log("Registering Schema 2...");
        bytes32 schema2UID = registry.register(
            SCHEMA_2,
            nounHolderResolver,
            true                 // revocable
        );
        console2.log("Schema 2 UID:");
        console2.logBytes32(schema2UID);

        // ── Step 6: Register Schema 3 with NO resolver ──
        // Schema 3 is issued programmatically by NounsPassportResolver.
        // It does not need its own resolver — the passport resolver is the
        // only attester and it enforces all logic internally.
        console2.log("Registering Schema 3 (Builder Passport)...");
        bytes32 schema3UID = registry.register(
            SCHEMA_3,
            ISchemaResolver(address(0)), // no external resolver
            true                         // revocable — superseded by new versions
        );
        console2.log("Schema 3 UID:");
        console2.logBytes32(schema3UID);

        // ── Step 7: Wire Schema 3 UID into NounsPassportResolver ──
        console2.log("Setting passport schema UID on NounsPassportResolver...");
        passportResolver.setPassportSchemaUID(schema3UID);
        console2.log("Done.");

        // ── Step 8: Wire NounHolderResolver address into NounsPassportResolver ──
        // So the holder resolver can increment/decrement peer verification counts
        console2.log("Setting peer verifier on NounsPassportResolver...");
        passportResolver.setPeerVerifier(address(nounHolderResolver));
        console2.log("Done.");

        vm.stopBroadcast();

        // ── Summary ──
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("NounsPassportResolver: ", address(passportResolver));
        console2.log("PropUpdateResolver:    ", address(propUpdateResolver));
        console2.log("NounHolderResolver:    ", address(nounHolderResolver));
        console2.log("Schema 1 UID:          "); console2.logBytes32(schema1UID);
        console2.log("Schema 2 UID:          "); console2.logBytes32(schema2UID);
        console2.log("Schema 3 UID:          "); console2.logBytes32(schema3UID);
        console2.log("\nNext steps:");
        console2.log("1. Verify contracts on Etherscan");
        console2.log("2. Confirm schemas on https://easscan.org");
        console2.log("3. Run historical bootstrap script for existing builders");
    }
}
