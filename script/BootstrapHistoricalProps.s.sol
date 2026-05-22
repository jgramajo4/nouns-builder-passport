// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Script, console2 } from "forge-std/Script.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from
    "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { IPropdates } from "../src/interfaces/IPropdates.sol";

/// @title BootstrapHistoricalProps
/// @notice Helper script for builders to retroactively attest milestones
///         from completed props that existed before this system launched.
///
/// Usage:
///   1. Set env vars:
///        MAINNET_RPC, PRIVATE_KEY (builder's wallet)
///        SCHEMA_1_UID (from DeployPassport output)
///        EAS_ADDRESS  (0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587)
///        PROPDATES    (0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4)
///
///   2. Populate the propIds array and txHashes array below with your
///      completed props and their original PostUpdate tx hashes.
///
///   3. Run:
///        forge script script/BootstrapHistoricalProps.s.sol \
///          --rpc-url $MAINNET_RPC \
///          --private-key $PRIVATE_KEY \
///          --broadcast
///
/// The resolver will verify each prop against live Propdates state.
/// Only props where msg.sender == propUpdateAdmin && isCompleted == true
/// will be accepted. The rest will revert (caught per-attestation below).
contract BootstrapHistoricalProps is Script {
    // ─── Fill these in before running ───────────────────────────────────────

    /// @dev Your completed prop IDs (historical) - fill in before running
    uint256[] internal propIds;

    /// @dev The original PostUpdate tx hash for the final update on each prop
    bytes32[] internal txHashes;

    /// @dev Short titles for each completed prop milestone
    string[] internal titles;

    /// @dev Evidence URIs (GitHub release, forum post, etc.)
    string[] internal evidenceURIs;

    /// @dev Populate arrays in setUp() so types are unambiguous
    function setUp() public {
        // ── Fill these in ────────────────────────────────────────────────
        // propIds.push(387);
        // propIds.push(412);
        //
        // txHashes.push(bytes32(0xabc123...));
        //
        // titles.push("Nouns dev tooling SDK v2 - completed");
        //
        // evidenceURIs.push("https://github.com/yourrepo/releases/tag/v2.0.0");
        // ─────────────────────────────────────────────────────────────────
    }

    // ────────────────────────────────────────────────────────────────────────

    address constant EAS_ADDRESS = 0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587;
    address constant PROPDATES   = 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4;

    function run() external {
        require(propIds.length > 0, "BootstrapHistoricalProps: no propIds set");
        require(propIds.length == txHashes.length, "BootstrapHistoricalProps: length mismatch");
        require(propIds.length == titles.length, "BootstrapHistoricalProps: length mismatch");
        require(propIds.length == evidenceURIs.length, "BootstrapHistoricalProps: length mismatch");

        bytes32 schema1UID = vm.envBytes32("SCHEMA_1_UID");

        IEAS eas = IEAS(EAS_ADDRESS);
        IPropdates propdates = IPropdates(PROPDATES);

        vm.startBroadcast();

        uint256 succeeded = 0;
        uint256 skipped   = 0;

        for (uint256 i = 0; i < propIds.length; i++) {
            uint256 propId = propIds[i];

            // Pre-flight: check Propdates state before sending tx
            IPropdates.PropdateInfo memory info = propdates.propdateInfo(propId);

            if (!info.isCompleted) {
                console2.log("Skipping prop %d - not marked completed on Propdates", propId);
                skipped++;
                continue;
            }

            if (info.propUpdateAdmin != msg.sender) {
                console2.log("Skipping prop %d - msg.sender is not propUpdateAdmin", propId);
                skipped++;
                continue;
            }

            // Encode Schema 1 attestation data
            bytes memory data = abi.encode(
                propId,
                titles[i],
                evidenceURIs[i],
                true,            // isFinal = true for completed historical props
                txHashes[i]      // original PostUpdate tx hash for auditability
            );

            // Submit attestation - resolver will re-verify on-chain
            bytes32 uid = eas.attest(
                AttestationRequest({
                    schema: schema1UID,
                    data: AttestationRequestData({
                        recipient:      address(0), // no specific recipient for milestones
                        expirationTime: 0,
                        revocable:      false,
                        refUID:         bytes32(0), // first milestone per prop - chain from here
                        data:           data,
                        value:          0
                    })
                })
            );

            console2.log("Prop %d attested - UID:", propId);
            console2.logBytes32(uid);
            succeeded++;
        }

        vm.stopBroadcast();

        console2.log("\n=== BOOTSTRAP COMPLETE ===");
        console2.log("Attested: %d", succeeded);
        console2.log("Skipped:  %d", skipped);
        console2.log("Check your Builder Passport on easscan.org");
    }
}
