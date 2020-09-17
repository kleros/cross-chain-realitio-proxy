pragma solidity ^0.6.12;

interface IHomeArbitrationProxy {
    /**
     * @dev Recieves the requested arbitration for a question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     * @param _requester The address of the user that requested arbitration.
     */
    function receiveArbitrationRequest(
        bytes32 _questionID,
        bytes32 _requesterAnswer,
        address _requester
    ) external;

    /**
     * @dev Recieves a failed attempt to request arbitration. TRUSTED.
     * @param _questionID The ID of the question.
     */
    function receiveArbitrationFailure(bytes32 _questionID) external;

    /**
     * @dev Recieves the new address of the requester if it changed. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _requester The address of the new requester.
     */
    function receiveRequesterChange(bytes32 _questionID, address _requester) external;

    /**
     * @dev Recieves the answer to a specified question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitratior.
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
}
