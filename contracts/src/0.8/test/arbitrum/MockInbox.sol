// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

/// @dev MockInbox contract to create a ticket and send msg from L2 to L1.
contract MockInbox {
    address public arbBridge;
    uint256 public submissionFee;
    uint256 public ticketID;

    struct Ticket {
        address target;
        bytes data;
    }

    mapping(uint256 => Ticket) public tickets;
    
    event TicketSent(
        address to,
        uint256 l2CallValue,
        uint256 maxSubmissionCost,
        address excessFeeRefundAddress,
        address callValueRefundAddress,
        uint256 gasLimit,
        uint256 maxFeePerGas
    );

    constructor(address _bridge, uint256 _submissionFee) {
        arbBridge = _bridge;
        submissionFee = _submissionFee;
    }

    /// @dev Should return the mock bridge.
    function bridge() external view returns (address) {
        return arbBridge;
    }

    function calculateRetryableSubmissionFee(uint256 /*dataLength*/, uint256 /*baseFee*/) external view returns (uint256) {
        return submissionFee;
    }

    function createRetryableTicket(
        address _to, // Home proxy
        uint256 _l2CallValue,
        uint256 _maxSubmissionCost,
        address _excessFeeRefundAddress,
        address _callValueRefundAddress,
        uint256 _gasLimit,
        uint256 _maxFeePerGas,
        bytes calldata _data
    ) external payable returns (uint256) {
        Ticket storage ticket = tickets[ticketID];
        ticket.target = _to;
        ticket.data = _data;
        emit TicketSent(_to, _l2CallValue, _maxSubmissionCost, _excessFeeRefundAddress, _callValueRefundAddress, _gasLimit, _maxFeePerGas);
        return ticketID++;
    }

    function redeemTicket(uint256 _ticketID) external {
        Ticket storage ticket = tickets[_ticketID];
        (bool success, ) = ticket.target.call(ticket.data);
        require(success, "Could not receive L1 msg");
    }
}