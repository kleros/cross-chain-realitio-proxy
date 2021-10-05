pragma solidity ^0.7.2;

import {IBridge} from "./IBridge.sol";
import {IAMB} from "../dependencies/IAMB.sol";

/**
 * @title XDai Bridge
 */
contract XDaiBridge is IBridge {
    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB internal immutable amb;

    /// @dev Address of the counter-party proxy on the Home Chain. TRUSTED.
    address internal immutable _homeProxy;

    /// @dev The chain ID where the home proxy is deployed.
    bytes32 internal immutable homeChainId;

    /// @dev Address of the counter-party proxy on the Foreign Chain. TRUSTED.
    address internal immutable _foreignProxy;

    /// @dev The chain ID where the foreign proxy is deployed.
    bytes32 internal immutable foreignChainId;

    function homeProxy() external view override returns (address) {
        return _homeProxy;
    }

    function foreignProxy() external view override returns (address) {
        return _foreignProxy;
    }

    constructor(
        IAMB _amb,
        address __homeProxy,
        bytes32 _homeChainId,
        address __foreignProxy,
        bytes32 _foreignChainId
    ) {
        amb = _amb;
        _homeProxy = __homeProxy;
        homeChainId = _homeChainId;
        _foreignProxy = __foreignProxy;
        foreignChainId = _foreignChainId;
    }

    function onlyHomeProxy() external override {
        require(msg.sender == address(amb), "Only AMB allowed");
        require(amb.messageSourceChainId() == homeChainId, "Only home chain allowed");
        require(amb.messageSender() == _homeProxy, "Only home proxy allowed");
    }

    function onlyForeignProxy() external override {
        require(msg.sender == address(amb), "Only AMB allowed");
        require(amb.messageSourceChainId() == foreignChainId, "Only foreign chain allowed");
        require(amb.messageSender() == _foreignProxy, "Only foreign proxy allowed");
    }

    function sendMessage(address _recipient, bytes memory _data) external override {
        amb.requireToPassMessage(_recipient, _data, amb.maxGasPerTx());
    }
}
