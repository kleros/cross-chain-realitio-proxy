pragma solidity ^0.8.0;

import {RealitioInterface} from "../../interfaces/RealitioInterface.sol";
import {RealitioHomeProxyPolygon} from "../../RealitioHomeProxyPolygon.sol";

import {MockForeignArbitrationProxyWithAppeals} from "./MockForeignArbitratorProxyWithAppeals.sol";

/**
 * @title Arbitration proxy for Realitio on Polygon side (A.K.A. the Home Chain).
 * @dev This contract is meant to be deployed on the side of Realitio.
 */
contract MockHomeArbitrationProxy is RealitioHomeProxyPolygon {
    constructor(
        address _fxChild,
        RealitioInterface _realitio,
        uint256 _foreignChainId,
        string memory _metadata
    ) RealitioHomeProxyPolygon(_fxChild, _realitio, _foreignChainId, _metadata) {}

    // Overridden to directly call the foreignProxy under test
    // instead of emitting an event
    function _sendMessageToRoot(bytes memory message) internal override {
        MockForeignArbitrationProxyWithAppeals(fxRootTunnel).processMessageFromChild(message);
    }
}
