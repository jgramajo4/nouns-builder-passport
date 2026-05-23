// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title INounsToken
/// @notice Minimal interface for the NounsToken contract
/// @dev Only the balanceOf function is needed for live holder checks
interface INounsToken {
    /// @notice Returns the number of Nouns owned by a given address
    /// @param owner The address to check
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}
