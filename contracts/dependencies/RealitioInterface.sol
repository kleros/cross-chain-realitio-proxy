// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

/* solhint-disable var-name-mixedcase */
interface RealitioInterface {
    /**
     * @dev The arbitrator contract is trusted to only call this if they've been paid, and tell us who paid them.
     * @notice Notify the contract that the arbitrator has been paid for a question, freezing it pending their decision.
     * @param question_id The ID of the question.
     * @param requester The account that requested arbitration.
     * @param max_previous If specified, reverts if a bond higher than this was submitted after you sent your transaction.
     */
    function notifyOfArbitrationRequest(
        bytes32 question_id,
        address requester,
        uint256 max_previous
    ) external;

    /**
     * @notice Cancel a previously-requested arbitration and extend the timeout
     * @dev Useful when doing arbitration across chains that can't be requested atomically
     * @param question_id The ID of the question
     */
    function cancelArbitrationRequest(bytes32 question_id) external;

    /**
     * @dev Doesn't require (or allow) a bond.
     * If the current final answer is correct, the account should be whoever submitted it.
     * If the current final answer is wrong, the account should be whoever paid for arbitration.
     * However, the answerer stipulations are not enforced by the contract.
     * @notice Submit the answer for a question, for use by the arbitrator.
     * @param question_id The ID of the question.
     * @param answer The answer, encoded into bytes32.
     * @param answerer The account credited with this answer for the purpose of bond claims.
     */
    function submitAnswerByArbitrator(
        bytes32 question_id,
        bytes32 answer,
        address answerer
    ) external;

    /**
     * @notice Report whether the answer to the specified question is finalized
     * @param question_id The ID of the question
     * @return Return true if finalized
     */
    function isFinalized(bytes32 question_id) external view returns (bool);

    /**
     * @notice Returns the current best answer.
     * @param question_id The ID of the question.
     * @return The current best answer.
     */
    function getBestAnswer(bytes32 question_id) external view returns (bytes32);

    /**
     * @notice Returns the history hash of the question.
     * @dev Updated on each answer, then rewound as each is claimed.
     * @param question_id The ID of the question.
     */
    function getHistoryHash(bytes32 question_id) external view returns (bytes32);

    /**
     * @notice Returns the commitment info by its id.
     * @param commitment_id The ID of the commitment.
     * @return Time after which the committed answer can be revealed.
     * @return Whether the commitment has already been revealed or not.
     * @return The committed answer, encoded as bytes32.
     */
    function commitments(bytes32 commitment_id)
        external
        view
        returns (
            uint32,
            bool,
            bytes32
        );
}
