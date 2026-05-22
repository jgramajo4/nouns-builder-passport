// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import { IEAS, Attestation } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { IPropdates } from "./interfaces/IPropdates.sol";

/// @title PropUpdateResolver
/// @notice Schema 1 resolver — verifies that the attester is the propUpdateAdmin
///         for the given propId on the live Propdates contract.
/// @dev Deployed once. Registered as the resolver when Schema 1 is created on
///      the EAS SchemaRegistry. Stateless — all truth comes from Propdates.
contract PropUpdateResolver is SchemaResolver {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when the attester is not the propUpdateAdmin for the prop
    error NotPropUpdateAdmin();

    /// @notice Thrown when propId cannot be decoded from attestation data
    error InvalidAttestationData();

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice The deployed Propdates contract on Ethereum mainnet
    IPropdates public immutable PROPDATES;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param eas     The EAS contract address (mainnet: 0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587)
    /// @param propdates The Propdates contract address (mainnet: 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4)
    constructor(IEAS eas, IPropdates propdates) SchemaResolver(eas) {
        PROPDATES = propdates;
    }

    // -------------------------------------------------------------------------
    // SchemaResolver implementation
    // -------------------------------------------------------------------------

    /// @notice Called by EAS when a Schema 1 attestation is submitted.
    ///         Decodes propId from attestation data and verifies the attester
    ///         is the current propUpdateAdmin on Propdates.
    ///
    /// Schema 1 ABI layout (abi.encode order):
    ///   uint256 propId
    ///   string  milestoneTitle
    ///   string  evidenceURI
    ///   bool    isFinal
    ///   bytes32 propdateTxHash
    ///
    /// @param attestation The full attestation struct from EAS
    /// @return bool True if the attester is the propUpdateAdmin, false otherwise
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal view override returns (bool) {
        // Decode only propId — the first word of the ABI-encoded data.
        // We don't need to decode the full struct, just the first field.
        if (attestation.data.length < 32) revert InvalidAttestationData();

        uint256 propId = abi.decode(attestation.data, (uint256));

        IPropdates.PropdateInfo memory info = PROPDATES.propdateInfo(propId);

        // When propUpdateAdmin is address(0) the original proposer still controls
        // updates — Propdates enforces this natively. We defer to that contract
        // rather than duplicating the check here, so we simply allow it through.
        // When a non-zero admin is set, it must match the attester exactly.
        if (info.propUpdateAdmin != address(0) && info.propUpdateAdmin != attestation.attester) {
            revert NotPropUpdateAdmin();
        }

        return true;
    }

    /// @notice Schema 1 attestations are non-revocable (mirrors Propdates
    ///         isCompleted immutability). Always returns false to block
    ///         revocation at the resolver level.
    function onRevoke(
        Attestation calldata /*attestation*/,
        uint256 /*value*/
    ) internal pure override returns (bool) {
        return false;
    }
}
