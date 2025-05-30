pragma solidity 0.8.25;

import {IRealitio} from "../../interfaces/IRealitio.sol";
import {RealitioHomeProxyPolygon} from "../../RealitioHomeProxyPolygon.sol";

import {MockRealitioForeignProxyPolygon} from "./MockRealitioForeignProxyPolygon.sol";

/**
 * @title Arbitration proxy for Realitio on Polygon side (A.K.A. the Home Chain).
 * @dev This contract is meant to be deployed on the side of Realitio.
 */
contract MockRealitioHomeProxyPolygon is RealitioHomeProxyPolygon {
    constructor(
        IRealitio _realitio,
        string memory _metadata,
        uint256 _foreignChainId,
        address _fxChild
    ) RealitioHomeProxyPolygon(_realitio, _metadata, _foreignChainId, _fxChild) {}

    // Overridden to directly call the foreignProxy under test
    // instead of emitting an event
    function _sendMessageToRoot(bytes memory message) internal override {
        MockRealitioForeignProxyPolygon(fxRootTunnel).processMessageFromChild(message);
    }
}
