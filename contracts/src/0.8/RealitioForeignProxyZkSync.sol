// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1]
 *  @reviewers: [@jaybuidl,@kokialgo]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.25;

import {IDisputeResolver, IArbitrator} from "@kleros/dispute-resolver-interface-contract-0.8/contracts/IDisputeResolver.sol";
import "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {IForeignArbitrationProxy, IHomeArbitrationProxy} from "./interfaces/IArbitrationProxies.sol";
import {SafeSend} from "./libraries/SafeSend.sol";

/**
 * @title Arbitration proxy for Realitio on Ethereum side (A.K.A. the Foreign Chain).
 * @dev This contract is meant to be deployed to the Ethereum chains where Kleros is deployed.
 * https://docs.zksync.io/zksync-protocol/rollup/l1_l2_communication
 */
contract RealitioForeignProxyZkSync is IForeignArbitrationProxy, IDisputeResolver {
    using SafeSend for address payable;

    /* Constants */
    // The number of choices for the arbitrator.
    uint256 public constant NUMBER_OF_CHOICES_FOR_ARBITRATOR = type(uint256).max;
    uint256 public constant REFUSE_TO_ARBITRATE_REALITIO = type(uint256).max; // Constant that represents "Refuse to rule" in realitio format.
    uint256 public constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.
    uint256 public constant L2_CALL_VALUE = 0; // Amount of ETH to pass with the call to L2. Used as msg.value for the transaction.
    uint256 public constant META_EVIDENCE_ID = 0; // The ID of the MetaEvidence for disputes.

    /* Storage */

    enum Status {
        None,
        Requested,
        Created,
        Ruled,
        Relayed,
        Failed
    }

    struct ArbitrationRequest {
        Status status; // Status of the arbitration.
        uint248 deposit; // The deposit paid by the requester at the time of the arbitration.
        uint256 disputeID; // The ID of the dispute in arbitrator contract.
        uint256 answer; // The answer given by the arbitrator.
        Round[] rounds; // Tracks each appeal round of a dispute.
    }

    struct DisputeDetails {
        uint256 arbitrationID; // The ID of the arbitration.
        address requester; // The address of the requester who managed to go through with the arbitration request.
    }

    // Round struct stores the contributions made to particular answers.
    struct Round {
        mapping(uint256 => uint256) paidFees; // Tracks the fees paid in this round in the form paidFees[answer].
        mapping(uint256 => bool) hasPaid; // True if the fees for this particular answer have been fully paid in the form hasPaid[answer].
        mapping(address => mapping(uint256 => uint256)) contributions; // Maps contributors to their contributions for each answer in the form contributions[address][answer].
        uint256 feeRewards; // Sum of reimbursable appeal fees available to the parties that made contributions to the answer that ultimately wins a dispute.
        uint256[] fundedAnswers; // Stores the answer choices that are fully funded.
    }

    address public deployer = msg.sender; // Deployer address. It will be set to 0 after setting HomeProxy.
    address public homeProxy; // Proxy on L2.

    address public immutable wNative; // Address of wrapped version of the chain's native currency. WETH-like.
    IArbitrator public immutable arbitrator; // The address of the arbitrator. TRUSTED.
    bytes public arbitratorExtraData; // The extra data used to raise a dispute in the arbitrator.

    IZkSync public immutable zkSyncAddress; // The current address of the zkSync L1 bridge.

    uint256 public immutable l2GasLimit; // Gas limit of the transaction call. Note some L2 operations consume up to 700000 gas. Default value is 1500000
    uint256 public immutable l2GasPerPubdataByteLimit; // L2 gas price for each published L1 calldata byte. Current default value is 800 https://docs.zksync.io/build/developer-reference/fee-model/how-l2-gas-price-works#note-on-l1l2-transactions
    uint256 public immutable surplusAmount; // The amount to add to arbitration fees to cover for zkSync fees. The leftover will be reimbursed. This is required for Realtio UI. Default value is 0.03 Eth.

    // Multipliers are in basis points.
    uint256 public immutable winnerMultiplier; // Multiplier for calculating the appeal fee that must be paid for the answer that was chosen by the arbitrator in the previous round.
    uint256 public immutable loserMultiplier; // Multiplier for calculating the appeal fee that must be paid for the answer that the arbitrator didn't rule for in the previous round.
    uint256 public immutable loserAppealPeriodMultiplier; // Multiplier for calculating the duration of the appeal period for the loser, in basis points.

    mapping(uint256 => mapping(address => ArbitrationRequest)) public arbitrationRequests; // Maps arbitration ID to its data. arbitrationRequests[uint(questionID)][requester].
    mapping(uint256 => DisputeDetails) public disputeIDToDisputeDetails; // Maps external dispute ids to local arbitration ID and requester who was able to complete the arbitration request.
    mapping(uint256 => bool) public arbitrationIDToDisputeExists; // Whether a dispute has already been created for the given arbitration ID or not.
    mapping(uint256 => address) public arbitrationIDToRequester; // Maps arbitration ID to the requester who was able to complete the arbitration request.
    mapping(uint256 => uint256) public arbitrationCreatedBlock; // Block of dispute creation.
    mapping(uint256 => mapping(uint256 => bool)) public isL2ToL1MessageProcessed; // Is used to indicate that zkSync L2 to L1 message was already processed. isL2ToL1MessageProcessed[l2BlockNumber][messageNumber]

    /**
     * @dev This is applied to functions called via consumeMessageFromL2() as a part of L2->L1 communication.
     * Note the functions requiring this modifier cannot be declared internal because
     * we still need the ABI generated of these functions to be able to call them
     * across contracts and have the compiler type check the function signatures.
     */
    modifier onlyL2() {
        require(msg.sender == address(this), "Only L2 allowed");
        _;
    }

    /**
     * @notice Creates an arbitration proxy on the foreign chain (L1).
     * @param _wNative The address of the wrapped version of the native currency.
     * @param _arbitrator Arbitrator contract address.
     * @param _arbitratorExtraData The extra data used to raise a dispute in the arbitrator.
     * @param _metaEvidence The URI of the meta evidence file.
     * @param _winnerMultiplier Multiplier for calculating the appeal cost of the winning answer.
     * @param _loserMultiplier Multiplier for calculating the appeal cost of the losing answer.
     * @param _loserAppealPeriodMultiplier Multiplier for calculating the appeal period for the losing answer.
     * @param _zkSyncAddress The current address of the zkSync L1 bridge.
     * @param _l2GasLimit Gas limit for L2 tx.
     * @param _l2GasPerPubdataByteLimit L2 gas price for each published L1 calldata byte.
     * @param _surplusAmount The surplus amount to cover zk fees.
     */
    constructor(
        address _wNative,
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        string memory _metaEvidence,
        uint256 _winnerMultiplier,
        uint256 _loserMultiplier,
        uint256 _loserAppealPeriodMultiplier,
        IZkSync _zkSyncAddress,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        uint256 _surplusAmount
    ) {
        wNative = _wNative;
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        winnerMultiplier = _winnerMultiplier;
        loserMultiplier = _loserMultiplier;
        loserAppealPeriodMultiplier = _loserAppealPeriodMultiplier;
        zkSyncAddress = _zkSyncAddress;
        l2GasLimit = _l2GasLimit;
        l2GasPerPubdataByteLimit = _l2GasPerPubdataByteLimit;
        surplusAmount = _surplusAmount;

        emit MetaEvidence(META_EVIDENCE_ID, _metaEvidence);
    }

    /* External and public */

    /**
     * @notice Set home proxy. Can only be done by deployer.
     * @param _homeProxy Address of the proxy on L2.
     */
    function setHomeProxy(address _homeProxy) external {
        require(msg.sender == deployer, "Only deployer can");
        homeProxy = _homeProxy;
        deployer = address(0);
    }

    // ************************ //
    // *    Realitio logic    * //
    // ************************ //

    /**
     * @notice Requests arbitration for the given question and contested answer.
     * This version of the function uses recommended bridging parameters.
     * Note that the signature of this function can't be changed as it's required by Reality UI.
     * @param _questionID The ID of the question.
     * @param _maxPrevious The maximum value of the current bond for the question. The arbitration request will get rejected if the current bond is greater than _maxPrevious. If set to 0, _maxPrevious is ignored.
     */
    function requestArbitration(bytes32 _questionID, uint256 _maxPrevious) external payable override {
        _requestArbitration(_questionID, _maxPrevious, [l2GasLimit, l2GasPerPubdataByteLimit], msg.sender);
    }

    /**
     * @notice Requests arbitration for the given question and contested answer.
     * This function is to be used if the bridging with default parameters fail.
     * @param _questionID The ID of the question.
     * @param _maxPrevious The maximum value of the current bond for the question. The arbitration request will get rejected if the current bond is greater than _maxPrevious. If set to 0, _maxPrevious is ignored.
     * @param _l2GasLimit Gas limit for tx on L2.
     * @param _l2GasPerPubdataByteLimit L2 gas price for each published L1 calldata byte.
     * @param _excessFeeRefundAddress The address on L2 to receive gas refunds.
     */
    function requestArbitrationCustomParameters(
        bytes32 _questionID,
        uint256 _maxPrevious,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        address _excessFeeRefundAddress
    ) external payable {
        _requestArbitration(_questionID, _maxPrevious, [_l2GasLimit, _l2GasPerPubdataByteLimit], _excessFeeRefundAddress);
    }

    /**
     * @notice Proves that the message was sent on L2.
     * @param _l2BlockNumber zkSync block number in which the message was sent
     * @param _index Message index, that can be received via API
     * @param _l2TxNumberInBlock The tx number in block.
     * @param _message The message that was sent from l2.
     * @param _proof Merkle proof for the message.
     */
    function consumeMessageFromL2(
        uint256 _l2BlockNumber,
        uint256 _index,
        uint16 _l2TxNumberInBlock,
        bytes calldata _message,
        bytes32[] calldata _proof
    ) external {
        // check that the message has not been processed yet
        require(!isL2ToL1MessageProcessed[_l2BlockNumber][_index], "Message already processed");

        L2Message memory message = L2Message({sender: homeProxy, data: _message, txNumberInBlock: _l2TxNumberInBlock});

        bool success = zkSyncAddress.proveL2MessageInclusion(_l2BlockNumber, _index, message, _proof);
        require(success, "Failed to prove message inclusion");

        // Mark message as processed
        isL2ToL1MessageProcessed[_l2BlockNumber][_index] = true;

        // Execute either `receiveArbitrationAcknowledgement` or `receiveArbitrationCancelation`
        (success, ) = address(this).call(_message);
        require(success, "Could not receive L2 call");
    }

    /**
     * @notice Receives the acknowledgement of the arbitration request for the given question and requester. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _requester The requester.
     */
    function receiveArbitrationAcknowledgement(bytes32 _questionID, address _requester) external override onlyL2 {
        uint256 arbitrationID = uint256(_questionID);
        ArbitrationRequest storage arbitration = arbitrationRequests[arbitrationID][_requester];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");

        // Arbitration cost can possibly change between when the request has been made and received, so evaluate once more.
        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        if (arbitration.deposit >= arbitrationCost) {
            try
                arbitrator.createDispute{value: arbitrationCost}(NUMBER_OF_CHOICES_FOR_ARBITRATOR, arbitratorExtraData)
            returns (uint256 disputeID) {
                DisputeDetails storage disputeDetails = disputeIDToDisputeDetails[disputeID];
                disputeDetails.arbitrationID = arbitrationID;
                disputeDetails.requester = _requester;

                arbitrationIDToDisputeExists[arbitrationID] = true;
                arbitrationIDToRequester[arbitrationID] = _requester;
                arbitrationCreatedBlock[disputeID] = block.number;

                // At this point, arbitration.deposit is guaranteed to be greater than or equal to the arbitration cost.
                uint256 remainder = arbitration.deposit - arbitrationCost;

                arbitration.status = Status.Created;
                arbitration.deposit = 0;
                arbitration.disputeID = disputeID;
                arbitration.rounds.push();

                if (remainder > 0) {
                    payable(_requester).safeSend(remainder, wNative);
                }

                emit ArbitrationCreated(_questionID, _requester, disputeID);
                emit Dispute(arbitrator, disputeID, META_EVIDENCE_ID, arbitrationID);
            } catch {
                arbitration.status = Status.Failed;
                emit ArbitrationFailed(_questionID, _requester);
            }
        } else {
            arbitration.status = Status.Failed;
            emit ArbitrationFailed(_questionID, _requester);
        }
    }

    /**
     * @notice Receives the cancelation of the arbitration request for the given question and requester. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _requester The requester.
     */
    function receiveArbitrationCancelation(bytes32 _questionID, address _requester) external override onlyL2 {
        uint256 arbitrationID = uint256(_questionID);
        ArbitrationRequest storage arbitration = arbitrationRequests[arbitrationID][_requester];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");
        uint256 deposit = arbitration.deposit;

        delete arbitrationRequests[arbitrationID][_requester];
        payable(_requester).safeSend(deposit, wNative);

        emit ArbitrationCanceled(_questionID, _requester);
    }

    /**
     * @notice Cancels the arbitration in case the dispute could not be created. Requires a small deposit to cover zk fees.
     * This version of the function uses recommended bridging parameters.
     * @param _questionID The ID of the question.
     * @param _requester The address of the arbitration requester.
     */
    function handleFailedDisputeCreation(bytes32 _questionID, address _requester) external payable override {
        _handleFailedDisputeCreation(_questionID, _requester, [l2GasLimit, l2GasPerPubdataByteLimit], msg.sender);
    }

    /**
     * @notice Cancels the arbitration in case the dispute could not be created. Requires a small deposit to cover zk fees.
     * This function is to be used if the bridging with default parameters fail.
     * @param _questionID The ID of the question.
     * @param _requester The address of the arbitration requester.
     * @param _l2GasLimit Gas limit for tx on L2.
     * @param _l2GasPerPubdataByteLimit L2 gas price for each published L1 calldata byte.
     * @param _excessFeeRefundAddress The address on L2 to receive gas refunds.
     */
    function handleFailedDisputeCreationCustomParameters(
        bytes32 _questionID,
        address _requester,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        address _excessFeeRefundAddress
    ) external payable {
        _handleFailedDisputeCreation(_questionID, _requester, [_l2GasLimit, _l2GasPerPubdataByteLimit], _excessFeeRefundAddress);
    }

    // ********************************* //
    // *    Appeals and arbitration    * //
    // ********************************* //

    /**
     * @notice Takes up to the total amount required to fund an answer. Reimburses the rest. Creates an appeal if at least two answers are funded.
     * @param _arbitrationID The ID of the arbitration, which is questionID cast into uint256.
     * @param _answer One of the possible rulings the arbitrator can give that the funder considers to be the correct answer to the question.
     * Note that the answer has Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     * Also note that '0' answer can be funded.
     * @return Whether the answer was fully funded or not.
     */
    function fundAppeal(uint256 _arbitrationID, uint256 _answer) external payable override returns (bool) {
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][
            arbitrationIDToRequester[_arbitrationID]
        ];
        require(arbitration.status == Status.Created, "No dispute to appeal.");

        uint256 disputeID = arbitration.disputeID;
        (uint256 appealPeriodStart, uint256 appealPeriodEnd) = arbitrator.appealPeriod(disputeID);
        require(block.timestamp >= appealPeriodStart && block.timestamp < appealPeriodEnd, "Appeal period is over.");

        uint256 multiplier;
        {
            uint256 winner = arbitrator.currentRuling(disputeID);
            if (winner == _answer) {
                multiplier = winnerMultiplier;
            } else {
                require(
                    block.timestamp - appealPeriodStart <
                        ((appealPeriodEnd - appealPeriodStart) * (loserAppealPeriodMultiplier)) / MULTIPLIER_DIVISOR,
                    "Appeal period is over for loser"
                );
                multiplier = loserMultiplier;
            }
        }

        uint256 lastRoundID = arbitration.rounds.length - 1;
        Round storage round = arbitration.rounds[lastRoundID];
        require(!round.hasPaid[_answer], "Appeal fee is already paid.");
        uint256 appealCost = arbitrator.appealCost(disputeID, arbitratorExtraData);
        uint256 totalCost = appealCost + ((appealCost * multiplier) / MULTIPLIER_DIVISOR);

        // Take up to the amount necessary to fund the current round at the current costs.
        uint256 contribution;
        if (totalCost <= round.paidFees[_answer]) {
            contribution = 0;
        } else {
            contribution = totalCost - (round.paidFees[_answer]) > msg.value
                ? msg.value
                : totalCost - (round.paidFees[_answer]);
            emit Contribution(_arbitrationID, lastRoundID, _answer, msg.sender, contribution);
        }

        round.contributions[msg.sender][_answer] += contribution;
        round.paidFees[_answer] += contribution;
        if (round.paidFees[_answer] >= totalCost) {
            round.feeRewards += round.paidFees[_answer];
            round.fundedAnswers.push(_answer);
            round.hasPaid[_answer] = true;
            emit RulingFunded(_arbitrationID, lastRoundID, _answer);
        }

        if (round.fundedAnswers.length > 1) {
            // At least two sides are fully funded.
            arbitration.rounds.push();

            round.feeRewards = round.feeRewards - appealCost;
            arbitrator.appeal{value: appealCost}(disputeID, arbitratorExtraData);
        }

        if (msg.value - contribution > 0) payable(msg.sender).safeSend(msg.value - contribution, wNative); // Sending extra value back to contributor.
        return round.hasPaid[_answer];
    }

    /**
     * @notice Sends the fee stake rewards and reimbursements proportional to the contributions made to the winner of a dispute. Reimburses contributions if there is no winner.
     * @param _arbitrationID The ID of the arbitration.
     * @param _beneficiary The address to send reward to.
     * @param _round The round from which to withdraw.
     * @param _answer The answer to query the reward from.
     * Note that the `_answer` has Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     * @return reward The withdrawn amount.
     */
    function withdrawFeesAndRewards(
        uint256 _arbitrationID,
        address payable _beneficiary,
        uint256 _round,
        uint256 _answer
    ) public override returns (uint256 reward) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        Round storage round = arbitration.rounds[_round];
        require(arbitration.status == Status.Ruled || arbitration.status == Status.Relayed, "Dispute not resolved");
        // Allow to reimburse if funding of the round was unsuccessful.
        if (!round.hasPaid[_answer]) {
            reward = round.contributions[_beneficiary][_answer];
        } else if (!round.hasPaid[arbitration.answer]) {
            // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
            // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
            reward = round.fundedAnswers.length > 1
                ? (round.contributions[_beneficiary][_answer] * round.feeRewards) /
                    (round.paidFees[round.fundedAnswers[0]] + round.paidFees[round.fundedAnswers[1]])
                : 0;
        } else if (arbitration.answer == _answer) {
            uint256 paidFees = round.paidFees[_answer];
            // Reward the winner.
            reward = paidFees > 0 ? (round.contributions[_beneficiary][_answer] * round.feeRewards) / paidFees : 0;
        }

        if (reward != 0) {
            round.contributions[_beneficiary][_answer] = 0;
            _beneficiary.safeSend(reward, wNative);
            emit Withdrawal(_arbitrationID, _round, _answer, _beneficiary, reward);
        }
    }

    /**
     * @notice Allows to withdraw any rewards or reimbursable fees for all rounds at once.
     * @dev This function is O(n) where n is the total number of rounds. Arbitration cost of subsequent rounds is `A(n) = 2A(n-1) + 1`.
     *      So because of this exponential growth of costs, you can assume n is less than 10 at all times.
     * @param _arbitrationID The ID of the arbitration.
     * @param _beneficiary The address that made contributions.
     * @param _contributedTo Answer that received contributions from contributor.
     * Note that the `_contributedTo` answer has Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     */
    function withdrawFeesAndRewardsForAllRounds(
        uint256 _arbitrationID,
        address payable _beneficiary,
        uint256 _contributedTo
    ) external override {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];

        uint256 numberOfRounds = arbitration.rounds.length;
        for (uint256 roundNumber = 0; roundNumber < numberOfRounds; roundNumber++) {
            withdrawFeesAndRewards(_arbitrationID, _beneficiary, roundNumber, _contributedTo);
        }
    }

    /**
     * @notice Allows to submit evidence for a particular question.
     * @param _arbitrationID The ID of the arbitration related to the question.
     * @param _evidenceURI Link to evidence.
     */
    function submitEvidence(uint256 _arbitrationID, string calldata _evidenceURI) external override {
        emit Evidence(arbitrator, _arbitrationID, msg.sender, _evidenceURI);
    }

    /**
     * @notice Rules a specified dispute. Can only be called by the arbitrator.
     * @dev Accounts for the situation where the winner loses a case due to paying less appeal fees than expected.
     * @param _disputeID The ID of the dispute in the ERC792 arbitrator.
     * @param _ruling The ruling given by the arbitrator.
     */
    function rule(uint256 _disputeID, uint256 _ruling) external override {
        DisputeDetails storage disputeDetails = disputeIDToDisputeDetails[_disputeID];
        uint256 arbitrationID = disputeDetails.arbitrationID;
        address requester = disputeDetails.requester;

        ArbitrationRequest storage arbitration = arbitrationRequests[arbitrationID][requester];
        require(msg.sender == address(arbitrator), "Only arbitrator allowed");
        require(arbitration.status == Status.Created, "Invalid arbitration status");
        uint256 finalRuling = _ruling;

        // If one side paid its fees, the ruling is in its favor. Note that if the other side had also paid, an appeal would have been created.
        Round storage round = arbitration.rounds[arbitration.rounds.length - 1];
        if (round.fundedAnswers.length == 1) finalRuling = round.fundedAnswers[0];

        arbitration.answer = finalRuling;
        arbitration.status = Status.Ruled;
        emit Ruling(arbitrator, _disputeID, finalRuling);
    }

    /**
     * @notice Relays the ruling to home proxy. Requires a small deposit to cover zk fees.
     * This version of the function uses recommended bridging parameters.
     * @param _questionID The ID of the question.
     * @param _requester The address of the arbitration requester.
     */
    function relayRule(bytes32 _questionID, address _requester) external payable {
        _relayRule(_questionID, _requester, [l2GasLimit, l2GasPerPubdataByteLimit], msg.sender);
    }

    /**
     * @notice Relays the ruling to home proxy. Requires a small deposit to cover zk fees.
     * This function is to be used if the bridging with default parameters fail.
     * @param _questionID The ID of the question.
     * @param _requester The address of the arbitration requester.
     * @param _l2GasLimit Gas limit for tx on L2.
     * @param _l2GasPerPubdataByteLimit L2 gas price for each published L1 calldata byte.
     * @param _excessFeeRefundAddress The address on L2 to receive gas refunds.
     */
    function relayRuleCustomParameters(
        bytes32 _questionID,
        address _requester,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        address _excessFeeRefundAddress
    ) external payable {
        _relayRule(_questionID, _requester, [_l2GasLimit, _l2GasPerPubdataByteLimit], _excessFeeRefundAddress);
    }

    /* External Views */

    /**
     * @notice Returns stake multipliers.
     * @return winner Winners stake multiplier.
     * @return loser Losers stake multiplier.
     * @return loserAppealPeriod Multiplier for calculating an appeal period duration for the losing side.
     * @return divisor Multiplier divisor.
     */
    function getMultipliers()
        external
        view
        override
        returns (uint256 winner, uint256 loser, uint256 loserAppealPeriod, uint256 divisor)
    {
        return (winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier, MULTIPLIER_DIVISOR);
    }

    /**
     * @notice Returns number of possible ruling options. Valid rulings are [0, return value].
     * @return count The number of ruling options.
     */
    function numberOfRulingOptions(uint256 /* _arbitrationID */) external pure override returns (uint256) {
        return NUMBER_OF_CHOICES_FOR_ARBITRATOR;
    }

    /**
     * @notice Gets the fee to create a dispute.
     * @return The fee to create a dispute.
     */
    function getDisputeFee(bytes32 /* _questionID */) external view override returns (uint256) {
        return arbitrator.arbitrationCost(arbitratorExtraData) + surplusAmount;
    }

    /**
     * @notice Gets the number of rounds of the specific question.
     * @param _arbitrationID The ID of the arbitration related to the question.
     * @return The number of rounds.
     */
    function getNumberOfRounds(uint256 _arbitrationID) external view returns (uint256) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        return arbitration.rounds.length;
    }

    /**
     * @notice Gets the information of a round of a question.
     * @param _arbitrationID The ID of the arbitration.
     * @param _round The round to query.
     * @return paidFees The amount of fees paid for each fully funded answer.
     * @return feeRewards The amount of fees that will be used as rewards.
     * @return fundedAnswers IDs of fully funded answers.
     * Note that the `fundedAnswers` have Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     */
    function getRoundInfo(
        uint256 _arbitrationID,
        uint256 _round
    ) external view returns (uint256[] memory paidFees, uint256 feeRewards, uint256[] memory fundedAnswers) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        Round storage round = arbitration.rounds[_round];
        fundedAnswers = round.fundedAnswers;

        paidFees = new uint256[](round.fundedAnswers.length);

        for (uint256 i = 0; i < round.fundedAnswers.length; i++) {
            paidFees[i] = round.paidFees[round.fundedAnswers[i]];
        }

        feeRewards = round.feeRewards;
    }

    /**
     * @notice Gets the information of a round of a question for a specific answer choice.
     * @param _arbitrationID The ID of the arbitration.
     * @param _round The round to query.
     * @param _answer The answer choice to get funding status for.
     * Note that the `_answer` has Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     * @return raised The amount paid for this answer.
     * @return fullyFunded Whether the answer is fully funded or not.
     */
    function getFundingStatus(
        uint256 _arbitrationID,
        uint256 _round,
        uint256 _answer
    ) external view returns (uint256 raised, bool fullyFunded) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        Round storage round = arbitration.rounds[_round];

        raised = round.paidFees[_answer];
        fullyFunded = round.hasPaid[_answer];
    }

    /**
     * @notice Gets contributions to the answers that are fully funded.
     * @param _arbitrationID The ID of the arbitration.
     * @param _round The round to query.
     * @param _contributor The address whose contributions to query.
     * @return fundedAnswers IDs of the answers that are fully funded.
     * Note that the `fundedAnswers` have Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     * @return contributions The amount contributed to each funded answer by the contributor.
     */
    function getContributionsToSuccessfulFundings(
        uint256 _arbitrationID,
        uint256 _round,
        address _contributor
    ) external view returns (uint256[] memory fundedAnswers, uint256[] memory contributions) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        Round storage round = arbitration.rounds[_round];

        fundedAnswers = round.fundedAnswers;
        contributions = new uint256[](round.fundedAnswers.length);

        for (uint256 i = 0; i < contributions.length; i++) {
            contributions[i] = round.contributions[_contributor][fundedAnswers[i]];
        }
    }

    /**
     * @notice Returns the sum of withdrawable amount.
     * @dev This function is O(n) where n is the total number of rounds.
     * @dev This could exceed the gas limit, therefore this function should be used only as a utility and not be relied upon by other contracts.
     * @param _arbitrationID The ID of the arbitration.
     * @param _beneficiary The contributor for which to query.
     * @param _contributedTo Answer that received contributions from contributor.
     * Note that the `_contributedTo` answer has Kleros denomination, meaning that it has '+1' offset compared to Realitio format.
     * @return sum The total amount available to withdraw.
     */
    function getTotalWithdrawableAmount(
        uint256 _arbitrationID,
        address payable _beneficiary,
        uint256 _contributedTo
    ) external view override returns (uint256 sum) {
        address requester = arbitrationIDToRequester[_arbitrationID];
        ArbitrationRequest storage arbitration = arbitrationRequests[_arbitrationID][requester];
        if (!(arbitration.status == Status.Ruled || arbitration.status == Status.Relayed)) return sum;

        uint256 finalAnswer = arbitration.answer;
        uint256 noOfRounds = arbitration.rounds.length;
        for (uint256 roundNumber = 0; roundNumber < noOfRounds; roundNumber++) {
            Round storage round = arbitration.rounds[roundNumber];

            if (!round.hasPaid[_contributedTo]) {
                // Allow to reimburse if funding was unsuccessful for this answer option.
                sum += round.contributions[_beneficiary][_contributedTo];
            } else if (!round.hasPaid[finalAnswer]) {
                // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
                // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
                sum += round.fundedAnswers.length > 1
                    ? (round.contributions[_beneficiary][_contributedTo] * round.feeRewards) /
                        (round.paidFees[round.fundedAnswers[0]] + round.paidFees[round.fundedAnswers[1]])
                    : 0;
            } else if (finalAnswer == _contributedTo) {
                uint256 paidFees = round.paidFees[_contributedTo];
                // Reward the winner.
                sum += paidFees > 0
                    ? (round.contributions[_beneficiary][_contributedTo] * round.feeRewards) / paidFees
                    : 0;
            }
        }
    }

    /**
     * @notice Casts question ID into uint256 thus returning the related arbitration ID.
     * @param _questionID The ID of the question.
     * @return The ID of the arbitration.
     */
    function questionIDToArbitrationID(bytes32 _questionID) external pure returns (uint256) {
        return uint256(_questionID);
    }

    /**
     * @notice Maps external (arbitrator side) dispute id to local (arbitrable) dispute id.
     * @param _externalDisputeID Dispute id as in arbitrator side.
     * @return localDisputeID Dispute id as in arbitrable contract.
     */
    function externalIDtoLocalID(uint256 _externalDisputeID) external view override returns (uint256) {
        return disputeIDToDisputeDetails[_externalDisputeID].arbitrationID;
    }

    // ****************************** //
    // *    Internal and private    * //
    // ****************************** //

    function _requestArbitration(bytes32 _questionID, uint256 _maxPrevious, uint256[2] memory _parameters, address _excessFeeRefundAddress) internal {
        require(homeProxy != address(0), "Home proxy is not set");
        require(!arbitrationIDToDisputeExists[uint256(_questionID)], "Dispute already created");

        ArbitrationRequest storage arbitration = arbitrationRequests[uint256(_questionID)][msg.sender];
        require(arbitration.status == Status.None, "Arbitration already requested");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        uint256 zkGasFee = getZkGasFee(_parameters[0], _parameters[1]); // l2GasLimit and l2GasPerPubdataByteLimit respectively.
        require(msg.value >= arbitrationCost + zkGasFee, "Deposit value too low");

        arbitration.status = Status.Requested;
        arbitration.deposit = uint248(msg.value - zkGasFee);

        bytes4 methodSelector = IHomeArbitrationProxy.receiveArbitrationRequest.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, msg.sender, _maxPrevious);

        zkSyncAddress.requestL2Transaction{value: zkGasFee}(
            homeProxy,
            L2_CALL_VALUE,
            data,
            _parameters[0], // l2GasLimit
            _parameters[1], // l2GasPerPubdataByteLimit
            new bytes[](0),
            _excessFeeRefundAddress
        );

        emit ArbitrationRequested(_questionID, msg.sender, _maxPrevious);
    }

    function _handleFailedDisputeCreation(
        bytes32 _questionID,
        address _requester,
        uint256[2] memory _parameters,
        address _excessFeeRefundAddress
    ) internal {
        uint256 arbitrationID = uint256(_questionID);
        ArbitrationRequest storage arbitration = arbitrationRequests[arbitrationID][_requester];
        require(arbitration.status == Status.Failed, "Invalid arbitration status");
        uint256 zkGasFee = getZkGasFee(_parameters[0], _parameters[1]); // l2GasLimit and l2GasPerPubdataByteLimit respectively.
        require(msg.value >= zkGasFee, "Should cover the zk fee");
        uint256 deposit = arbitration.deposit;

        // Note that we don't nullify the status to allow the function to be called
        // multiple times to avoid intentional blocking.
        // Also note that since the status is not nullified the requester must use a different address
        // to make a new request for the same question.
        arbitration.deposit = 0;
        uint256 surplusValue = msg.value - zkGasFee;
        payable(msg.sender).safeSend(surplusValue, wNative);
        payable(_requester).safeSend(deposit, wNative);

        bytes4 methodSelector = IHomeArbitrationProxy.receiveArbitrationFailure.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, _requester);
        zkSyncAddress.requestL2Transaction{value: zkGasFee}(
            homeProxy,
            L2_CALL_VALUE,
            data,
            _parameters[0], // l2GasLimit
            _parameters[1], // l2GasPerPubdataByteLimit
            new bytes[](0),
            _excessFeeRefundAddress
        );

        emit ArbitrationCanceled(_questionID, _requester);
    }

    function _relayRule(bytes32 _questionID, address _requester, uint256[2] memory _parameters, address _excessFeeRefundAddress) internal {
        uint256 arbitrationID = uint256(_questionID);
        ArbitrationRequest storage arbitration = arbitrationRequests[arbitrationID][_requester];
        // Note that we allow to relay multiple times to prevent intentional blocking.
        require(arbitration.status == Status.Ruled || arbitration.status == Status.Relayed, "Dispute not resolved");

        uint256 zkGasFee = getZkGasFee(_parameters[0], _parameters[1]); // l2GasLimit and l2GasPerPubdataByteLimit respectively.
        require(msg.value >= zkGasFee, "Should cover the zk fee");

        arbitration.status = Status.Relayed;

        // Realitio ruling is shifted by 1 compared to Kleros.
        uint256 realitioRuling = arbitration.answer != 0 ? arbitration.answer - 1 : REFUSE_TO_ARBITRATE_REALITIO;

        bytes4 methodSelector = IHomeArbitrationProxy.receiveArbitrationAnswer.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, bytes32(realitioRuling));

        zkSyncAddress.requestL2Transaction{value: zkGasFee}(
            homeProxy,
            L2_CALL_VALUE,
            data,
            _parameters[0], // l2GasLimit
            _parameters[1], // l2GasPerPubdataByteLimit
            new bytes[](0),
            _excessFeeRefundAddress
        );
        emit RulingRelayed(_questionID, bytes32(realitioRuling));

        if (msg.value - zkGasFee > 0) payable(msg.sender).safeSend(msg.value - zkGasFee, wNative); // Sending extra value back to contributor.
    }

    /**
     * @notice Gets the required fee for sending tx to L2.
     * @param _l2GasLimit Gas limit for tx on L2.
     * @param _l2GasPerPubdataByteLimit L2 gas price for each published L1 calldata byte.
     * @return zkGasFee Required fee.
     */
    function getZkGasFee(
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit
    ) private view returns (uint256 zkGasFee) {
        uint256 gasPrice = tx.gasprice;
        zkGasFee = zkSyncAddress.l2TransactionBaseCost(gasPrice, _l2GasLimit, _l2GasPerPubdataByteLimit);
    }
}
