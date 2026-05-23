// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title INounsPassportResolver
/// @notice Minimal interface for NounHolderResolver to call back into the passport resolver
interface INounsPassportResolver {
    function incrementPeerVerification(address builder) external;
}
