// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

contract MockZkSync {
    uint256 public l2GasPrice;

    struct L2Message {
        uint16 txNumberInBlock;
        address sender;
        bytes data;
    }

    constructor(uint256 _l2GasPrice) {
        l2GasPrice = _l2GasPrice;
    }

    event L2Request(
        address _contractL2,
        uint256 _l2Value,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        address _refundRecipient
    );

    function requestL2Transaction(
        address _contractL2,
        uint256 _l2Value,
        bytes calldata _calldata,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        bytes[] calldata /*_factoryDeps*/,
        address _refundRecipient
    ) external payable returns (bytes32) {
        (bool success, ) = _contractL2.call(_calldata);
        require(success, "Could not receive homeProxy call");
        emit L2Request(_contractL2, _l2Value, _l2GasLimit, _l2GasPerPubdataByteLimit, _refundRecipient);
    }

    function l2TransactionBaseCost(
        uint256 /*_gasPrice*/,
        uint256 /*_l2GasLimit*/,
        uint256 /*_l2GasPerPubdataByteLimit*/
    ) public view returns (uint256) {
        return l2GasPrice;
    }

    function proveL2MessageInclusion(
        uint256 /*_blockNumber*/,
        uint256 /*_index*/,
        L2Message memory /*_message*/,
        bytes32[] calldata /*_proof*/
    ) public pure returns (bool) {
        return true;
    }
}
