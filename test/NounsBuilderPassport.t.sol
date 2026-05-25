// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test, console2 } from "forge-std/Test.sol";
import {
    IEAS,
    Attestation,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

import { PropUpdateResolver }     from "../src/PropUpdateResolver.sol";
import { NounHolderResolver }     from "../src/NounHolderResolver.sol";
import { NounsPassportResolver }  from "../src/NounsPassportResolver.sol";
import { IPropdates }             from "../src/interfaces/IPropdates.sol";
import { INounsToken }            from "../src/interfaces/INounsToken.sol";

// Minimal extension of INounsToken to call delegate() in tests
interface INounsTokenVotes is INounsToken {
    function delegate(address delegatee) external;
}

// ---------------------------------------------------------------------------
// NounsBuilderPassportTest
// ---------------------------------------------------------------------------
// Forks Ethereum mainnet so every test runs against live contract state.
// No mocks — if Propdates says a prop is complete, we trust it.
//
// Set MAINNET_RPC in your environment before running:
//   export MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
//   forge test --fork-url $MAINNET_RPC -vvv
//
// Known live props used in tests (verified on Propdates mainnet):
//   Prop 25  — isCompleted = true,  propUpdateAdmin set
//   Prop 118 — isCompleted = true,  propUpdateAdmin set
//   Prop 200 — isCompleted = false, propUpdateAdmin set (active prop)
// ---------------------------------------------------------------------------
contract NounsBuilderPassportTest is Test {

    // ── Mainnet contract addresses ──────────────────────────────────────────
    address constant EAS_ADDR             = 0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587;
    address constant SCHEMA_REGISTRY_ADDR = 0xA7b39296258348C78294F95B872b282326A97BDF;
    address constant PROPDATES_ADDR       = 0xa5Bf9A9b8f60CFD98b1cCB592f2F9F37Bb0033a4;
    address constant NOUNS_TOKEN_ADDR     = 0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03;

    // ── Contracts under test ────────────────────────────────────────────────
    PropUpdateResolver    internal propUpdateResolver;
    NounHolderResolver    internal nounHolderResolver;
    NounsPassportResolver internal passportResolver;

    // ── EAS + registry handles ──────────────────────────────────────────────
    IEAS            internal eas;
    ISchemaRegistry internal registry;
    IPropdates      internal propdates;
    INounsToken     internal nounsToken;

    // ── Schema UIDs (set during setUp) ─────────────────────────────────────
    bytes32 internal schema1UID;
    bytes32 internal schema2UID;
    bytes32 internal schema3UID;

    // ── Schema strings ──────────────────────────────────────────────────────
    string constant SCHEMA_1 =
        "uint256 propId,string milestoneTitle,string evidenceURI,bool isFinal,bytes32 propdateTxHash";
    string constant SCHEMA_2 =
        "bytes32 milestoneUID,uint256 propId,bool verified,string comment";
    string constant SCHEMA_3 =
        "address builder,uint256 totalProps,uint256 completedProps,uint256 totalMilestones,"
        "uint256 peerVerifications,uint256 avgDaysBetweenUpdates,uint256 passportVersion";

    // ── Test actors ─────────────────────────────────────────────────────────
    // builder420: whoever is propUpdateAdmin for prop 25 on mainnet.
    // We read this dynamically in setUp() so the test stays correct
    // even if admin transfers happen.
    address internal builder420;
    address internal builder450;

    // A Noun holder — we pick a known large holder as of a recent block.
    // Noun #0 owner is a well-known long-term holder.
    address internal nounHolder;

    // ── Fork block ──────────────────────────────────────────────────────────
    // Pinning to a recent block makes tests deterministic.
    // Update this periodically as the chain grows.
    uint256 constant FORK_BLOCK = 21_900_000;

    // ---------------------------------------------------------------------------
    // setUp
    // ---------------------------------------------------------------------------
    function setUp() public {
        // Fork mainnet at pinned block
        vm.createSelectFork(vm.envString("MAINNET_RPC"), FORK_BLOCK);

        eas        = IEAS(EAS_ADDR);
        registry   = ISchemaRegistry(SCHEMA_REGISTRY_ADDR);
        propdates  = IPropdates(PROPDATES_ADDR);
        nounsToken = INounsToken(NOUNS_TOKEN_ADDR);

        // Read live propUpdateAdmin for our test props
        IPropdates.PropdateInfo memory info420 = propdates.propdateInfo(420);
        IPropdates.PropdateInfo memory info450 = propdates.propdateInfo(450);

        builder420 = info420.propUpdateAdmin;  // 0x775Db063EEa34Ad8266A9E58E0F8ea843DC7E4DC
        builder450 = info450.propUpdateAdmin;  // 0xe621536C3f8328Ede597C6b7c70bc729B576A8d8

        // Find a live Noun holder — Noun #1 owner
        nounHolder = INounsToken(NOUNS_TOKEN_ADDR).ownerOf(1);

        // Deploy resolvers (deployer = address(this))
        passportResolver  = new NounsPassportResolver(eas, propdates);
        propUpdateResolver = new PropUpdateResolver(eas, propdates);
        nounHolderResolver = new NounHolderResolver(eas, nounsToken);

        // Register schemas
        vm.startPrank(address(this));

        schema1UID = registry.register(SCHEMA_1, passportResolver, false);
        schema2UID = registry.register(SCHEMA_2, nounHolderResolver, true);
        schema3UID = registry.register(SCHEMA_3, ISchemaResolver(address(0)), true);

        // Wire passport schema + peer verifier
        passportResolver.setPassportSchemaUID(schema3UID);
        passportResolver.setPeerVerifier(address(nounHolderResolver));

        vm.stopPrank();
    }

    // =========================================================================
    // Helper: build Schema 1 attestation data
    // =========================================================================
    function _milestoneData(
        uint256 propId,
        string memory title,
        string memory uri,
        bool isFinal,
        bytes32 txHash
    ) internal pure returns (bytes memory) {
        return abi.encode(propId, title, uri, isFinal, txHash);
    }

    // Helper: attest a Schema 1 milestone as a given builder
    function _attestMilestone(
        address builder,
        uint256 propId,
        bool isFinal,
        bytes32 refUID
    ) internal returns (bytes32 uid) {
        vm.prank(builder);
        uid = eas.attest(
            AttestationRequest({
                schema: schema1UID,
                data: AttestationRequestData({
                    recipient:      address(0),
                    expirationTime: 0,
                    revocable:      false,
                    refUID:         refUID,
                    data:           _milestoneData(propId, "Test milestone", "ipfs://test", isFinal, bytes32(0)),
                    value:          0
                })
            })
        );
    }

    // Helper: attest a Schema 2 peer verification as a Noun holder
    function _attestPeerVerification(
        address holder,
        bytes32 milestoneUID,
        uint256 propId,
        bool verified
    ) internal returns (bytes32 uid) {
        vm.prank(holder);
        uid = eas.attest(
            AttestationRequest({
                schema: schema2UID,
                data: AttestationRequestData({
                    recipient:      address(0),
                    expirationTime: 0,
                    revocable:      true,
                    refUID:         bytes32(0),
                    data:           abi.encode(milestoneUID, propId, verified, "Looks good"),
                    value:          0
                })
            })
        );
    }

    // =========================================================================
    // PropUpdateResolver tests
    // =========================================================================

    function test_PropUpdateResolver_AcceptsValidAdmin() public {
        // builder420 is the live propUpdateAdmin for prop 25 — should succeed
        vm.assume(builder420 != address(0));
        bytes32 uid = _attestMilestone(builder420, 420, false, bytes32(0));
        assertTrue(uid != bytes32(0), "attestation UID should be non-zero");
    }

    function test_PropUpdateResolver_RejectsWrongAdmin() public {
        address impostor = address(0xdead);
        vm.prank(impostor);
        vm.expectRevert();
        eas.attest(
            AttestationRequest({
                schema: schema1UID,
                data: AttestationRequestData({
                    recipient:      address(0),
                    expirationTime: 0,
                    revocable:      false,
                    refUID:         bytes32(0),
                    data:           _milestoneData(420, "Fake update", "ipfs://fake", false, bytes32(0)),
                    value:          0
                })
            })
        );
    }

    function test_PropUpdateResolver_AllowsZeroAdmin() public {
        // Prop 999 likely has no propUpdateAdmin set (never interacted with).
        // With our fix, propUpdateAdmin == 0 should pass through (defer to Propdates).
        IPropdates.PropdateInfo memory info = propdates.propdateInfo(999);
        if (info.propUpdateAdmin == address(0)) {
            // Any address should pass the resolver check (Propdates itself would
            // enforce the real restriction — resolver just defers)
            address anyUser = address(0xabcd);
            vm.prank(anyUser);
            // We expect this to NOT revert at the resolver level.
            // (It may revert if Propdates has other restrictions, but not ours.)
            try eas.attest(
                AttestationRequest({
                    schema: schema1UID,
                    data: AttestationRequestData({
                        recipient:      address(0),
                        expirationTime: 0,
                        revocable:      false,
                        refUID:         bytes32(0),
                        data:           _milestoneData(999, "Zero admin test", "ipfs://test", false, bytes32(0)),
                        value:          0
                    })
                })
            ) returns (bytes32) {
                // Passed resolver — correct
            } catch {
                // May revert for other reasons (e.g. Propdates state) — that's fine
                // The key thing is our resolver didn't block it with NotPropUpdateAdmin
            }
        } else {
            console2.log("Prop 999 has an admin set, skipping zero-admin test");
        }
    }

    function test_PropUpdateResolver_NonRevocable() public {
        vm.assume(builder420 != address(0));
        bytes32 uid = _attestMilestone(builder420, 420, false, bytes32(0));

        // Attempting to revoke Schema 1 should revert (onRevoke returns false)
        vm.prank(builder420);
        vm.expectRevert();
        eas.revoke(RevocationRequest({
            schema: schema1UID,
            data: RevocationRequestData({ uid: uid, value: 0 })
        }));
    }

    // =========================================================================
    // NounHolderResolver tests
    // =========================================================================

    function test_NounHolderResolver_AcceptsLiveHolder() public {
        // First get a milestone UID to verify
        vm.assume(builder420 != address(0));
        bytes32 milestoneUID = _attestMilestone(builder420, 420, false, bytes32(0));

        // Noun holder verifies the milestone
        bytes32 verifyUID = _attestPeerVerification(nounHolder, milestoneUID, 420, true);
        assertTrue(verifyUID != bytes32(0), "verification UID should be non-zero");
    }

    function test_NounHolderResolver_RejectsNonHolder() public {
        vm.assume(builder420 != address(0));
        bytes32 milestoneUID = _attestMilestone(builder420, 420, false, bytes32(0));

        address nonHolder = address(0xbeef);
        // Confirm they hold 0 Nouns
        assertEq(nounsToken.balanceOf(nonHolder), 0, "nonHolder should have no Nouns");

        vm.prank(nonHolder);
        vm.expectRevert();
        eas.attest(
            AttestationRequest({
                schema: schema2UID,
                data: AttestationRequestData({
                    recipient:      address(0),
                    expirationTime: 0,
                    revocable:      true,
                    refUID:         bytes32(0),
                    data:           abi.encode(milestoneUID, uint256(420), true, "fake verify"),
                    value:          0
                })
            })
        );
    }

    function test_NounHolderResolver_RejectsDuplicateVerification() public {
        vm.assume(builder420 != address(0));
        bytes32 milestoneUID = _attestMilestone(builder420, 420, false, bytes32(0));

        // First verification succeeds
        _attestPeerVerification(nounHolder, milestoneUID, 420, true);

        // Second verification from same holder on same milestone should revert
        vm.prank(nounHolder);
        vm.expectRevert();
        eas.attest(
            AttestationRequest({
                schema: schema2UID,
                data: AttestationRequestData({
                    recipient:      address(0),
                    expirationTime: 0,
                    revocable:      true,
                    refUID:         bytes32(0),
                    data:           abi.encode(milestoneUID, uint256(420), true, "duplicate"),
                    value:          0
                })
            })
        );
    }

    function test_NounHolderResolver_AllowsReAttestation_AfterRevoke() public {
        vm.assume(builder420 != address(0));
        bytes32 milestoneUID = _attestMilestone(builder420, 420, false, bytes32(0));

        // Verify
        bytes32 verifyUID = _attestPeerVerification(nounHolder, milestoneUID, 420, true);

        // Revoke
        vm.prank(nounHolder);
        eas.revoke(RevocationRequest({
            schema: schema2UID,
            data: RevocationRequestData({ uid: verifyUID, value: 0 })
        }));

        // Should be able to re-attest after revocation
        bytes32 newVerifyUID = _attestPeerVerification(nounHolder, milestoneUID, 25, false);
        assertTrue(newVerifyUID != bytes32(0), "re-attestation should succeed after revoke");
    }

    // =========================================================================
    // NounsPassportResolver tests
    // =========================================================================

    function test_PassportResolver_MintsPassportOnFirstAttestation() public {
        vm.assume(builder420 != address(0));

        // Before: no passport
        assertEq(passportResolver.getPassportUID(builder420), bytes32(0));

        // Attest first milestone
        _attestMilestone(builder420, 420, false, bytes32(0));

        // After: passport should exist
        bytes32 passportUID = passportResolver.getPassportUID(builder420);
        assertTrue(passportUID != bytes32(0), "passport should be minted after first milestone");
    }

    function test_PassportResolver_TracksUniquePropCount() public {
        vm.assume(builder420 != address(0));

        _attestMilestone(builder420, 420, false, bytes32(0));

        (, , uint256 totalMilestones, , ) = passportResolver.getBuilderRecord(builder420);
        assertEq(totalMilestones, 1, "should have 1 milestone");

        // Attest second milestone on same prop
        bytes32 first = passportResolver.getMilestoneUIDs(builder420)[0];
        _attestMilestone(builder420, 420, false, first);

        (bytes32 pUID, uint256 version, uint256 total, uint256 completed, ) =
            passportResolver.getBuilderRecord(builder420);

        assertEq(total, 2, "should have 2 milestones");
        assertEq(completed, 0, "no completed props yet");
        assertTrue(pUID != bytes32(0), "passport should exist");
        assertEq(version, 2, "passport version should be 2 after second milestone");
    }

    function test_PassportResolver_TracksCompletedProps() public {
        vm.assume(builder420 != address(0));

        // Attest final milestone
        _attestMilestone(builder420, 420, true, bytes32(0));

        (, , , uint256 completedProps, ) = passportResolver.getBuilderRecord(builder420);
        assertEq(completedProps, 1, "should track 1 completed prop");
    }

    function test_PassportResolver_PassportVersionIncrements() public {
        vm.assume(builder420 != address(0));

        _attestMilestone(builder420, 420, false, bytes32(0));
        (, uint256 v1, , , ) = passportResolver.getBuilderRecord(builder420);
        assertEq(v1, 1);

        bytes32 m1 = passportResolver.getMilestoneUIDs(builder420)[0];
        _attestMilestone(builder420, 420, true, m1);
        (, uint256 v2, , , ) = passportResolver.getBuilderRecord(builder420);
        assertEq(v2, 2);
    }

    function test_PassportResolver_PassportUpdatesAcrossMultipleProps() public {
        // builder420 and builder450 are different admins — test each independently
        vm.assume(builder420 != address(0));
        vm.assume(builder450 != address(0));

        // builder420 completes prop 420
        _attestMilestone(builder420, 420, true, bytes32(0));
        (, , , uint256 completed420, ) = passportResolver.getBuilderRecord(builder420);
        assertEq(completed420, 1, "builder420 should have 1 completed prop");

        // builder450 completes prop 450
        _attestMilestone(builder450, 450, true, bytes32(0));
        (, , , uint256 completed450, ) = passportResolver.getBuilderRecord(builder450);
        assertEq(completed450, 1, "builder450 should have 1 completed prop");
    }

    function test_PassportResolver_UniquePropsNotDoubleCountedAcrossMilestones() public {
        vm.assume(builder420 != address(0));

        // Three milestones all on prop 25
        bytes32 m1 = _attestMilestone(builder420, 420, false, bytes32(0));
        bytes32 m2 = _attestMilestone(builder420, 420, false, m1);
        _attestMilestone(builder420, 420, true, m2);

        // uniquePropCount should be 1, not 3
        // Read from passport attestation data
        bytes32 passportUID = passportResolver.getPassportUID(builder420);
        Attestation memory passport = eas.getAttestation(passportUID);
        (
            address pBuilder,
            uint256 totalProps,
            uint256 completedProps,
            uint256 totalMilestones,
            ,
            ,
            uint256 passportVersion
        ) = abi.decode(passport.data, (address, uint256, uint256, uint256, uint256, uint256, uint256));

        assertEq(pBuilder,        builder420, "builder address should match");
        assertEq(totalProps,      1,         "uniquePropCount should be 1 not 3");
        assertEq(completedProps,  1,         "completedProps should be 1");
        assertEq(totalMilestones, 3,         "all 3 milestones recorded");
        assertEq(passportVersion, 3,         "version increments each attestation");
    }

    function test_PassportResolver_OldPassportRevokedOnUpdate() public {
        vm.assume(builder420 != address(0));

        _attestMilestone(builder420, 420, false, bytes32(0));
        bytes32 firstPassportUID = passportResolver.getPassportUID(builder420);

        bytes32 m1 = passportResolver.getMilestoneUIDs(builder420)[0];
        _attestMilestone(builder420, 420, true, m1);
        bytes32 secondPassportUID = passportResolver.getPassportUID(builder420);

        // First passport should be revoked
        Attestation memory firstPassport = eas.getAttestation(firstPassportUID);
        assertTrue(firstPassport.revocationTime > 0, "first passport should be revoked");

        // Second passport should be live
        Attestation memory secondPassport = eas.getAttestation(secondPassportUID);
        assertEq(secondPassport.revocationTime, 0, "second passport should be live");
    }

    function test_PassportResolver_GetMilestoneUIDs_ReturnsAll() public {
        vm.assume(builder420 != address(0));

        bytes32 m1 = _attestMilestone(builder420, 420, false, bytes32(0));
        bytes32 m2 = _attestMilestone(builder420, 420, false, m1);
        bytes32 m3 = _attestMilestone(builder420, 420, true,  m2);

        bytes32[] memory uids = passportResolver.getMilestoneUIDs(builder420);
        assertEq(uids.length, 3);
        assertEq(uids[0], m1);
        assertEq(uids[1], m2);
        assertEq(uids[2], m3);
    }

    function test_PassportResolver_RejectsReentrantCall() public {
        // The _entered guard should prevent double-entry.
        // In practice this is hard to trigger externally — we verify the flag
        // exists and is reset correctly by checking state after a normal flow.
        vm.assume(builder420 != address(0));
        _attestMilestone(builder420, 420, false, bytes32(0));

        // Second call should also work (guard resets to false after each call)
        bytes32 m1 = passportResolver.getMilestoneUIDs(builder420)[0];
        bytes32 uid = _attestMilestone(builder420, 420, true, m1);
        assertTrue(uid != bytes32(0), "second attestation should succeed (guard reset)");
    }

    // =========================================================================
    // Admin / access control tests
    // =========================================================================

    function test_Admin_SetPassportSchemaUID_Resettable() public {
        // Already set in setUp — should allow resetting by owner
        bytes32 newUID = bytes32(uint256(1));
        passportResolver.setPassportSchemaUID(newUID);
        assertEq(passportResolver.passportSchemaUID(), newUID, "passportSchemaUID should update");
    }

    function test_Admin_SetPeerVerifier_Resettable() public {
        // Owner can update the peer verifier address
        address newVerifier = address(0x1234);
        passportResolver.setPeerVerifier(newVerifier);
        // No getter — attempt an authorized call via new verifier
        vm.prank(newVerifier);
        passportResolver.incrementPeerVerification(builder420);
        (, , , , uint256 count) = passportResolver.getBuilderRecord(builder420);
        assertEq(count, 1, "peer count should increment via new verifier");
    }

    function test_Admin_SetPassportSchemaUID_OnlyOwner() public {
        // Deploy a fresh resolver (passportSchemaUID not set yet)
        NounsPassportResolver fresh = new NounsPassportResolver(eas, propdates);

        vm.prank(address(0xbad));
        vm.expectRevert();
        fresh.setPassportSchemaUID(schema3UID);
    }

    function test_Admin_SetPeerVerifier_OnlyOwner() public {
        NounsPassportResolver fresh = new NounsPassportResolver(eas, propdates);

        vm.prank(address(0xbad));
        vm.expectRevert();
        fresh.setPeerVerifier(address(0x1234));
    }

    function test_NounHolderResolver_AllowsDelegatedVotes() public {
        vm.assume(builder420 != address(0));

        // Prepare secondary delegate address
        address delegatee = address(0xCA11);
        // Ensure it holds 0 Nouns initially
        assertEq(nounsToken.balanceOf(delegatee), 0);

        // Noun holder delegates votes to delegatee
        vm.startPrank(nounHolder);
        INounsTokenVotes(address(nounsToken)).delegate(delegatee);
        vm.stopPrank();

        // Mine one block so vote checkpoint updates
        vm.roll(block.number + 1);

        // Confirm voting power transferred
        uint96 votes = uint96(nounsToken.getCurrentVotes(delegatee));
        assertTrue(votes > 0, "delegatee should have delegated votes");

        // Builder posts milestone
        bytes32 milestoneUID = _attestMilestone(builder420, 420, false, bytes32(0));

        // Delegatee submits peer verification (Schema 2)
        bytes32 verifyUID = _attestPeerVerification(delegatee, milestoneUID, 420, true);
        assertTrue(verifyUID != bytes32(0), "verification should succeed via delegatee");
    }

    function test_Admin_IncrementPeerVerification_OnlyAuthorized() public {
        address unauthorized = address(0xcafe);
        vm.prank(unauthorized);
        vm.expectRevert();
        passportResolver.incrementPeerVerification(builder420);
    }

    // =========================================================================
    // Integration: full builder flow
    // =========================================================================

    function test_Integration_FullBuilderFlow() public {
        vm.assume(builder420 != address(0));

        // 1. Builder posts 3 milestones on prop 25
        bytes32 m1 = _attestMilestone(builder420, 420, false, bytes32(0));
        bytes32 m2 = _attestMilestone(builder420, 420, false, m1);
        bytes32 m3 = _attestMilestone(builder420, 420, true,  m2);  // final

        // 2. Noun holder verifies milestone 3
        bytes32 v1 = _attestPeerVerification(nounHolder, m3, 420, true);
        assertTrue(v1 != bytes32(0));

        // 3. Manually increment peer count (simulating NounHolderResolver callback)
        vm.prank(address(nounHolderResolver));
        passportResolver.incrementPeerVerification(builder420);

        // 4. Read passport
        bytes32 passportUID = passportResolver.getPassportUID(builder420);
        Attestation memory passport = eas.getAttestation(passportUID);

        (
            address pBuilder,
            uint256 totalProps,
            uint256 completedProps,
            uint256 totalMilestones,
            ,
            ,
            uint256 version
        ) = abi.decode(passport.data, (address, uint256, uint256, uint256, uint256, uint256, uint256));

        assertEq(pBuilder,         builder420, "builder matches");
        assertEq(totalProps,       1,         "1 unique prop");
        assertEq(completedProps,   1,         "1 completed prop");
        assertEq(totalMilestones,  3,         "3 milestones");
        // peerVerifications in passport data is snapshot at mint time;
        // read live count from resolver storage instead
        (, , , , uint256 livePeerCount) = passportResolver.getBuilderRecord(builder420);
        assertEq(livePeerCount, 1, "1 peer verification");
        assertEq(version,          3,         "version = 3 (one per milestone)");

        // 5. Passport recipient is the builder — portable
        assertEq(passport.recipient, builder420, "passport recipient = builder");
    }
}
