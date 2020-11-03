// SPDX-License-Identifier: MIT
pragma solidity ^0.7.2;

interface IHomeArbitrationProxy {
    /**
     * @dev Receives the requested arbitration for a question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     * @param _requester The address of the user that requested arbitration.
     */
    function receiveArbitrationRequest(
        bytes32 _questionID,
        bytes32 _contestedAnswer,
        address _requester
    ) external;

    /**
     * @dev Receives a failed attempt to request arbitration. TRUSTED.
     * @param _questionID The ID of the question.
     */
    function receiveArbitrationFailure(bytes32 _questionID) external;

    /**
     * @dev Receives the answer to a specified question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitrator.
     */
    function receiveArbitrationAnswer(bytes32 _questionID, bytes32 _answer) external;
}

interface IForeignArbitrationProxy {
    /**
     * @dev Requests arbitration for given question ID. TRUSTED.
     * @param _questionID The ID of the question.
     */
    function acknowledgeArbitration(bytes32 _questionID) external;

    /**
     * @dev Cancels the arbitration request. TRUSTED.
     * @param _questionID The ID of the question.
     */
    function cancelArbitration(bytes32 _questionID) external;

    /**
     * @notice Gets the fee to create a dispute.
     * @return The fee to create a dispute.
     */
    function getDisputeFee(bytes32 questionID) external view returns (uint256);
}
