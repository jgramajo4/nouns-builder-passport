// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import { IEAS, Attestation } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { INounsToken } from "./interfaces/INounsToken.sol";
import { INounsPassportResolver } from "./interfaces/INounsPassportResolver.sol";

/// @title NounHolderResolver
/// @notice Schema 2 resolver — verifies that the attester currently holds at
///         least one Noun, and that they haven't already submitted a
///         non-revoked attestation for this milestoneUID.
/// @dev Live balanceOf check (no snapshot). Revocable — a Nouner can update
///      their view. One attestation per holder per milestone enforced here.
contract NounHolderResolver is SchemaResolver {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when the attester holds zero Nouns
    error NotANounHolder();

    /// @notice Thrown when the attester already has a non-revoked attestation
    ///         for this milestoneUID
    error AlreadyVerified();

    /// @notice Thrown when milestoneUID cannot be decoded from attestation data
    error InvalidAttestationData();

    /// @notice Thrown when passport resolver is already set
    error AlreadyConfigured();

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The deployed NounsToken contract on Ethereum mainnet
    INounsToken public immutable NOUNS_TOKEN;
    address public immutable OWNER;

    /// @notice The passport resolver to notify on successful peer verification.
    ///         Optional — if not set, the resolver works standalone.
    INounsPassportResolver public passportResolver;

    /// @notice Tracks whether an address has a live (non-revoked) attestation
    ///         for a given milestoneUID.
    ///         nounerMilestoneAttestation[attester][milestoneUID] = attestationUID
    ///         Zero bytes32 means no live attestation.
    mapping(address => mapping(bytes32 => bytes32)) public nounerMilestoneAttestation;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param eas        The EAS contract address
    /// @param nounsToken The NounsToken address (mainnet: 0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03)
    constructor(IEAS eas, INounsToken nounsToken) SchemaResolver(eas) {
        NOUNS_TOKEN = nounsToken;
        OWNER = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice Wire up the passport resolver. One-time set, owner only.
    /// @param resolver The deployed NounsPassportResolver address
    function setPassportResolver(address resolver) external {
        require(msg.sender == OWNER, "NounHolderResolver: not owner");
        if (address(passportResolver) != address(0)) revert AlreadyConfigured();
        passportResolver = INounsPassportResolver(resolver);
    }

    // -------------------------------------------------------------------------
    // SchemaResolver implementation
    // -------------------------------------------------------------------------

    /// @notice Called by EAS when a Schema 2 attestation is submitted.
    ///
    /// Schema 2 ABI layout (abi.encode order):
    ///   bytes32 milestoneUID   — refUID pointing to a Schema 1 attestation
    ///   uint256 propId         — for direct queryability
    ///   bool    verified       — true = confirmed, false = disputed
    ///   string  comment        — optional context
    ///
    /// Checks:
    ///   1. Attester holds ≥ 1 Noun right now
    ///   2. No live attestation from this address for this milestoneUID
    ///
    /// @param attestation The full attestation struct from EAS
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal override returns (bool) {
        // 1. Live Noun holder check
        if (
                    NOUNS_TOKEN.balanceOf(attestation.attester) == 0 &&
                    NOUNS_TOKEN.getCurrentVotes(attestation.attester) == 0
                ) {
                    revert NotANounHolder();
                }

        // 2. Decode milestoneUID from the first 32 bytes of data
        if (attestation.data.length < 32) revert InvalidAttestationData();
        bytes32 milestoneUID = abi.decode(attestation.data, (bytes32));

        // 3. One-per-holder-per-milestone check
        if (nounerMilestoneAttestation[attestation.attester][milestoneUID] != bytes32(0)) {
            revert AlreadyVerified();
        }

        // 4. Record the attestation UID so we can clear it on revocation
        nounerMilestoneAttestation[attestation.attester][milestoneUID] = attestation.uid;

        // 5. Notify passport resolver (if wired up)
        //    We decode the builder from the referenced milestone attestation.
        //    The milestone attester IS the builder.
        if (address(passportResolver) != address(0)) {
            Attestation memory milestone = _eas.getAttestation(milestoneUID);
            if (milestone.attester != address(0)) {
                passportResolver.incrementPeerVerification(milestone.attester);
            }
        }

        return true;
    }

    /// @notice Schema 2 is revocable — a Nouner can change their view.
    ///         Clears the tracking mapping so they can re-attest if desired.
    function onRevoke(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal override returns (bool) {
        if (attestation.data.length < 32) return true; // nothing to clear

        bytes32 milestoneUID = abi.decode(attestation.data, (bytes32));
        delete nounerMilestoneAttestation[attestation.attester][milestoneUID];

        return true;
    }
}
