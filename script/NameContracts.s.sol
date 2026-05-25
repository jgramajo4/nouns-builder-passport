// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Ens} from "enscribe/Ens.sol";

contract NameNounsPassportContracts is Script {
    // NounsPassport resolver contracts
    address constant NOUNS_PASSPORT_RESOLVER = 0xc73B1fe64638fe415db2985a4a3B1F0bEBAafd33;
    address constant NOUN_HOLDER_RESOLVER    = 0xc0EDB7B49409936385dA7bB623CA3c50482cFDf0;
    address constant PROP_UPDATE_RESOLVER    = 0x4960e774Ad4290EAB05DF6DEA277FeF0c1A26125;

    function run() public {
        vm.startBroadcast();

        bool r1 = Ens.setForwardResolution(block.chainid, NOUNS_PASSPORT_RESOLVER, "resolver.nounspassport.eth");
        bool r2 = Ens.setForwardResolution(block.chainid, NOUN_HOLDER_RESOLVER,    "holder-resolver.nounspassport.eth");
        bool r3 = Ens.setForwardResolution(block.chainid, PROP_UPDATE_RESOLVER,    "prop-resolver.nounspassport.eth");

        console.log("resolver.nounspassport.eth:", r1);
        console.log("holder-resolver.nounspassport.eth:  ", r2);
        console.log("prop-resolver.nounspassport.eth:    ", r3);

        vm.stopBroadcast();
    }
}
