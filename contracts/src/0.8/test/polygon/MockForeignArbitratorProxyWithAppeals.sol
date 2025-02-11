pragma solidity 0.8.25;

import {IArbitrator} from "@kleros/erc-792/contracts/IArbitrator.sol";
import {RealitioForeignProxyPolygon} from "../../RealitioForeignProxyPolygon.sol";

/**
 * @title Arbitration proxy for Realitio on Ethereum side (A.K.A. the Foreign Chain).
 * @dev This contract is meant to be deployed to the Ethereum chains where Kleros is deployed.
 */
contract MockForeignArbitrationProxyWithAppeals is RealitioForeignProxyPolygon {
    constructor(
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        string memory _metaEvidence,
        uint256 _winnerMultiplier,
        uint256 _loserMultiplier,
        uint256 _loserAppealPeriodMultiplier,
        address _checkpointManager,
        address _fxRoot
    )
        RealitioForeignProxyPolygon(
            _arbitrator,
            _arbitratorExtraData,
            _metaEvidence,
            _winnerMultiplier,
            _loserMultiplier,
            _loserAppealPeriodMultiplier,
            _checkpointManager,
            _fxRoot
        )
    {}

    // Helper method to test _processMessageFromChild directly without having to call internal
    // _validateAndExtractMessage
    function processMessageFromChild(bytes memory message) public {
        _processMessageFromChild(message);
    }
}
