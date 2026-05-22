// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IPropdates
/// @notice Interface for the deployed Propdates contract
/// @dev Matches the ABI of 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4
interface IPropdates {
    struct PropdateInfo {
        // Address which can post updates for this prop
        address propUpdateAdmin;
        // When the last update was posted (unix timestamp)
        uint88 lastUpdated;
        // Whether the primary work is considered done (immutable once true)
        bool isCompleted;
    }

    /// @notice Returns the propdate info for a given prop
    /// @param propId The Nouns proposal ID
    function propdateInfo(uint256 propId) external view returns (PropdateInfo memory);
}
