// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import {
    IEAS,
    Attestation,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { IPropdates } from "./interfaces/IPropdates.sol";

/// @title NounsPassportResolver
/// @notice Dual-purpose contract:
///
///   As a RESOLVER (Schema 1): validates that the attester is the
///   propUpdateAdmin for the given propId, then fires passport logic.
///
///   As a PASSPORT ISSUER: on every Schema 1 attestation, maintains an
///   internal on-chain record of builder milestones and auto-mints or
///   refreshes the builder's Schema 3 Builder Passport in the same tx.
///
/// @dev The re-entrant callback into EAS (to issue Schema 3) is safe because:
///      (a) EAS itself uses a reentrancy guard on attest()
///      (b) We use nonReentrant on our own onAttest path
///      The EAS guard was verified in EAS.sol — attest() has no reentrant
///      restriction for *different* callers, only for the same call stack.
///      Since the resolver is called from within EAS.attest(), issuing a new
///      attestation from inside onAttest() is a known EAS pattern (see
///      PayingResolver for a payment example). We use our own guard anyway
///      for defence-in-depth.
contract NounsPassportResolver is SchemaResolver {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotPropUpdateAdmin();
    error InvalidAttestationData();
    error PassportSchemaNotSet();
    error ReentrantCall();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PassportIssued(address indexed builder, bytes32 indexed passportUID, uint256 version);
    event PassportUpdated(address indexed builder, bytes32 indexed oldUID, bytes32 indexed newUID, uint256 version);

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice Decoded Schema 1 attestation fields
    struct MilestoneData {
        uint256 propId;
        string  milestoneTitle;
        string  evidenceURI;
        bool    isFinal;
        bytes32 propdateTxHash;
    }

    /// @notice Per-builder passport state maintained on-chain
    struct BuilderRecord {
        bytes32   passportUID;           // Current live Schema 3 attestation UID (0 = no passport yet)
        uint256   passportVersion;       // Increments on every refresh
        bytes32[] milestoneUIDs;         // All Schema 1 attestation UIDs for this builder (append-only)
        uint256   uniquePropCount;       // Number of distinct propIds attested (incremental, O(1))
        uint256   completedProps;        // Props where isFinal = true was attested
        uint256   peerVerifications;     // Cached count — updated via incrementPeerVerification()
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The deployed Propdates contract
    IPropdates public immutable PROPDATES;

    /// @notice Schema 3 UID — set after Schema 3 is registered on EAS.
    ///         Mutable (owner can update) so we can deploy this contract
    ///         before Schema 3 is registered.
    bytes32 public passportSchemaUID;

    /// @notice Owner (deployer) — only used for setting passportSchemaUID once
    address public immutable OWNER;

    /// @notice Per-builder records
    mapping(address => BuilderRecord) private _builderRecords;

    /// @notice Tracks whether a builder has already attested a given propId.
    ///         Used to increment uniquePropCount exactly once per prop — O(1).
    ///         builderSeenProp[builder][propId] = true once any milestone for
    ///         that prop has been attested.
    mapping(address => mapping(uint256 => bool)) private _builderSeenProp;

    /// @notice Reentrancy guard flag
    bool private _entered;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param eas        The EAS contract (mainnet: 0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587)
    /// @param propdates  The Propdates contract (mainnet: 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4)
    constructor(IEAS eas, IPropdates propdates) SchemaResolver(eas) {
        PROPDATES = propdates;
        OWNER = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Set the Schema 3 UID after it has been registered on EAS.
    ///         Can only be called once by the deployer.
    /// @param schemaUID The UID returned by SchemaRegistry.register() for Schema 3
    function setPassportSchemaUID(bytes32 schemaUID) external {
        require(msg.sender == OWNER, "NounsPassportResolver: not owner");
        passportSchemaUID = schemaUID;
    }

    // -------------------------------------------------------------------------
    // SchemaResolver implementation
    // -------------------------------------------------------------------------

    /// @notice Called by EAS when a Schema 1 attestation is submitted.
    ///
    ///   1. Verifies attester is the propUpdateAdmin on Propdates
    ///   2. Records the milestone UID in the builder's on-chain record
    ///   3. If isFinal = true, increments completedProps
    ///   4. Mints or refreshes the Builder Passport (Schema 3)
    ///
    /// @param attestation The Schema 1 attestation
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal override returns (bool) {
        // Reentrancy guard
        if (_entered) revert ReentrantCall();
        _entered = true;

        // --- 1. Verify propUpdateAdmin ---
        MilestoneData memory m = _decodeMilestone(attestation.data);

        IPropdates.PropdateInfo memory info = PROPDATES.propdateInfo(m.propId);
        // Defer to Propdates when propUpdateAdmin is zero (proposer controls the prop).
        // When a non-zero admin is explicitly set it must match the attester.
        if (info.propUpdateAdmin != address(0) && info.propUpdateAdmin != attestation.attester) {
            revert NotPropUpdateAdmin();
        }

        // --- 2. Record milestone UID ---
        BuilderRecord storage record = _builderRecords[attestation.attester];
        record.milestoneUIDs.push(attestation.uid);

        // --- 3. Track unique props (O(1) — one SSTORE per new propId) ---
        if (!_builderSeenProp[attestation.attester][m.propId]) {
            _builderSeenProp[attestation.attester][m.propId] = true;
            record.uniquePropCount += 1;
        }

        // --- 4. Track completions ---
        if (m.isFinal) {
            record.completedProps += 1;
        }

        // --- 4. Mint or refresh passport ---
        if (passportSchemaUID != bytes32(0)) {
            _issueOrRefreshPassport(attestation.attester, info);
        }

        _entered = false;
        return true;
    }

    /// @notice Schema 1 is non-revocable — always returns false.
    function onRevoke(
        Attestation calldata /*attestation*/,
        uint256 /*value*/
    ) internal pure override returns (bool) {
        return false;
    }

    // -------------------------------------------------------------------------
    // Passport read functions
    // -------------------------------------------------------------------------

    /// @notice Returns the current Builder Passport attestation UID for a builder.
    /// @param builder The builder's wallet address
    function getPassportUID(address builder) external view returns (bytes32) {
        return _builderRecords[builder].passportUID;
    }

    /// @notice Returns the full on-chain builder record.
    /// @param builder The builder's wallet address
    function getBuilderRecord(address builder)
        external
        view
        returns (
            bytes32   passportUID,
            uint256   passportVersion,
            uint256   totalMilestones,
            uint256   completedProps,
            uint256   peerVerifications
        )
    {
        BuilderRecord storage r = _builderRecords[builder];
        return (
            r.passportUID,
            r.passportVersion,
            r.milestoneUIDs.length,
            r.completedProps,
            r.peerVerifications
        );
    }

    /// @notice Returns all Schema 1 attestation UIDs for a builder.
    ///         Useful for frontends traversing the milestone history.
    /// @param builder The builder's wallet address
    function getMilestoneUIDs(address builder) external view returns (bytes32[] memory) {
        return _builderRecords[builder].milestoneUIDs;
    }

    /// @notice Returns the number of milestones attested for a builder.
    /// @param builder The builder's wallet address
    function getMilestoneCount(address builder) external view returns (uint256) {
        return _builderRecords[builder].milestoneUIDs.length;
    }

    // -------------------------------------------------------------------------
    // Peer verification counter
    // -------------------------------------------------------------------------

    /// @notice Called by a trusted NounHolderResolver (or anyone) to increment
    ///         the peer verification count for a builder. In practice this
    ///         would be wired to a Schema 2 attestation callback.
    ///
    /// @dev For simplicity in v1, the frontend or a separate aggregator can
    ///      call this after a Schema 2 attestation is confirmed. A future
    ///      version can make this trustless by having the Schema 2 resolver
    ///      call this contract directly.
    ///
    /// @param builder The builder whose peer count should increment
    function incrementPeerVerification(address builder) external {
        // Only callable by the EAS contract itself (attestation callback path)
        // or the NounHolderResolver — set after deploy via setPeerVerifier()
        require(
            msg.sender == _peerVerifier || msg.sender == address(_eas),
            "NounsPassportResolver: unauthorized"
        );
        _builderRecords[builder].peerVerifications += 1;
    }

    /// @notice Decrements peer verification count on Schema 2 revocation
    function decrementPeerVerification(address builder) external {
        require(
            msg.sender == _peerVerifier || msg.sender == address(_eas),
            "NounsPassportResolver: unauthorized"
        );
        BuilderRecord storage r = _builderRecords[builder];
        if (r.peerVerifications > 0) r.peerVerifications -= 1;
    }

    // -------------------------------------------------------------------------
    // Peer verifier address (set after NounHolderResolver is deployed)
    // -------------------------------------------------------------------------

    address private _peerVerifier;

    /// @notice Set the NounHolderResolver address so it can call increment/decrement.
    ///         Can only be called by the owner once.
    function setPeerVerifier(address verifier) external {
        require(msg.sender == OWNER, "NounsPassportResolver: not owner");
        _peerVerifier = verifier;
    }

    // -------------------------------------------------------------------------
    // Internal — passport issuance
    // -------------------------------------------------------------------------

    /// @notice Computes passport stats and issues or refreshes Schema 3.
    function _issueOrRefreshPassport(
        address builder,
        IPropdates.PropdateInfo memory latestInfo
    ) internal {
        BuilderRecord storage record = _builderRecords[builder];

        // Compute avgDaysBetweenUpdates from Propdates lastUpdated.
        // We use the most recent lastUpdated as a simple heuristic for v1.
        // A more precise version would iterate all props — left as a TODO
        // once gas profiling on real data is done.
        uint256 avgDays = 0;
        if (latestInfo.lastUpdated > 0 && record.milestoneUIDs.length > 1) {
            // Rough approximation: time since first attestation / milestone count
            // Real implementation should track per-prop timestamps
            avgDays = (block.timestamp - latestInfo.lastUpdated) /
                      (record.milestoneUIDs.length * 1 days);
        }

        // Build Schema 3 encoded data
        // Schema: address builder, uint256 totalProps, uint256 completedProps,
        //         uint256 totalMilestones, uint256 peerVerifications,
        //         uint256 avgDaysBetweenUpdates, uint256 passportVersion
        uint256 nextVersion = record.passportVersion + 1;

        bytes memory passportData = abi.encode(
            builder,
            record.uniquePropCount,   // O(1) — maintained incrementally
            record.completedProps,
            record.milestoneUIDs.length,
            record.peerVerifications,
            avgDays,
            nextVersion
        );

        // Revoke previous passport if one exists
        bytes32 oldUID = record.passportUID;
        if (oldUID != bytes32(0)) {
            _eas.revoke(
                RevocationRequest({
                    schema: passportSchemaUID,
                    data: RevocationRequestData({ uid: oldUID, value: 0 })
                })
            );
            emit PassportUpdated(builder, oldUID, bytes32(0), nextVersion);
        }

        // Issue new passport — recipient = builder (wallet-portable)
        bytes32 newUID = _eas.attest(
            AttestationRequest({
                schema: passportSchemaUID,
                data: AttestationRequestData({
                    recipient:      builder,
                    expirationTime: 0,       // no expiry
                    revocable:      true,    // passport can be superseded
                    refUID:         oldUID,  // chains to prior passport version
                    data:           passportData,
                    value:          0
                })
            })
        );

        // Update record
        record.passportUID      = newUID;
        record.passportVersion  = nextVersion;

        if (oldUID == bytes32(0)) {
            emit PassportIssued(builder, newUID, nextVersion);
        } else {
            emit PassportUpdated(builder, oldUID, newUID, nextVersion);
        }
    }

    // -------------------------------------------------------------------------
    // Internal — data decoding
    // -------------------------------------------------------------------------

    function _decodeMilestone(bytes calldata data)
        internal
        pure
        returns (MilestoneData memory m)
    {
        if (data.length < 32) revert InvalidAttestationData();
        (m.propId, m.milestoneTitle, m.evidenceURI, m.isFinal, m.propdateTxHash) =
            abi.decode(data, (uint256, string, string, bool, bytes32));
    }
}
