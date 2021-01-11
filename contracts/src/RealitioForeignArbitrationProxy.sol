// SPDX-License-Identifier: MIT

/**
 *  @authors: [@hbarcelos]
 *  @reviewers: [@ferittuncer*, @fnanni-0, @nix1g]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.7.2;

import "@kleros/erc-792/contracts/IArbitrator.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/erc-792/contracts/erc-1497/IEvidence.sol";
import "./dependencies/IAMB.sol";
import "./ArbitrationProxyInterfaces.sol";

contract RealitioForeignArbitrationProxy is IForeignArbitrationProxy, IArbitrable, IEvidence {
    /// @dev The contract governor. TRUSTED.
    address public governor = msg.sender;

    /// @dev The address of the arbitrator. TRUSTED.
    IArbitrator public immutable arbitrator;

    /// @dev The extra data used to raise a dispute in the arbitrator.
    bytes public arbitratorExtraData;

    /// @dev The ID of the MetaEvidence for disputes.
    uint256 public metaEvidenceID;

    /// @dev The number of choices for the arbitrator.
    uint256 public constant NUMBER_OF_CHOICES_FOR_ARBITRATOR = (2**256) - 2;

    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB public immutable amb;

    /// @dev Address of the counter-party proxy on the Home Chain. TRUSTED.
    address public homeProxy;

    /// @dev The chain ID where the home proxy is deployed.
    uint256 public homeChainId;

    /// @dev The path for the Terms of Service for Kleros as an arbitrator for Realitio.
    string public termsOfService;

    enum Status {None, Requested, Created, Failed}

    struct Arbitration {
        // Status of the arbitration.
        Status status;
        // Address that made the arbitration request.
        address payable requester;
        // The deposit paid by the requester at the time of the arbitration.
        uint256 deposit;
    }

    /// @dev Tracks arbitration requests for question ID.
    mapping(bytes32 => Arbitration) public arbitrations;

    /// @dev Associates dispute IDs to question IDs.
    mapping(uint256 => bytes32) public disputeIDToQuestionID;

    /**
     * @notice Should be emitted when the arbitration is requested.
     * @param _questionID The ID of the question to be arbitrated.
     * @param _answer The answer provided by the requester.
     * @param _requester The requester.
     */
    event ArbitrationRequested(bytes32 indexed _questionID, bytes32 _answer, address indexed _requester);

    /**
     * @notice Should be emitted when the dispute is created.
     * @param _questionID The ID of the question to be arbitrated.
     * @param _disputeID The ID of the dispute.
     */
    event ArbitrationCreated(bytes32 indexed _questionID, uint256 indexed _disputeID);

    /**
     * @notice Should be emitted when the dispute could not be created.
     * @dev This will happen if there is an increase in the arbitration fees
     * between the time the arbitration is made and the time it is acknowledged.
     * @param _questionID The ID of the question to be arbitrated.
     */
    event ArbitrationFailed(bytes32 indexed _questionID);

    /**
     * @notice Should be emitted when the arbitration is canceled by the Home Chain.
     * @param _questionID The ID of the question to be arbitrated.
     */
    event ArbitrationCanceled(bytes32 indexed _questionID);

    modifier onlyArbitrator() {
        require(msg.sender == address(arbitrator), "Only arbitrator allowed");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor allowed");
        _;
    }

    modifier onlyHomeProxy() {
        require(msg.sender == address(amb), "Only AMB allowed");
        require(amb.messageSourceChainId() == bytes32(homeChainId), "Only home chain allowed");
        require(amb.messageSender() == homeProxy, "Only home proxy allowed");
        _;
    }

    modifier onlyIfInitialized() {
        require(homeProxy != address(0), "Not initialized yet");
        _;
    }

    /**
     * @notice Creates an arbitration proxy on the foreign chain.
     * @dev Contract will still require initialization before being usable.
     * @param _amb ArbitraryMessageBridge contract address.
     * @param _arbitrator Arbitrator contract address.
     * @param _arbitratorExtraData The extra data used to raise a dispute in the arbitrator.
     * @param _metaEvidence The URI of the meta evidence file.
     * @param _termsOfService The path for the Terms of Service for Kleros as an arbitrator for Realitio.
     */
    constructor(
        IAMB _amb,
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        string memory _metaEvidence,
        string memory _termsOfService
    ) {
        amb = _amb;
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        termsOfService = _termsOfService;

        emit MetaEvidence(metaEvidenceID, _metaEvidence);
    }

    /**
     * @notice Changes the address of a new governor.
     * @param _governor The address of the new governor.
     */
    function changeGovernor(address _governor) external onlyGovernor {
        governor = _governor;
    }

    /**
     * @notice Sets the address of the arbitration proxy on the Home Chain.
     * @param _homeProxy The address of the proxy.
     * @param _homeChainId The chain ID where the home proxy is deployed.
     */
    function setHomeProxy(address _homeProxy, uint256 _homeChainId) external onlyGovernor {
        require(homeProxy == address(0), "Home proxy already set");

        homeProxy = _homeProxy;
        homeChainId = _homeChainId;
    }

    /**
     * @notice Changes the meta evidence used for disputes.
     * @param _metaEvidence URI to the new meta evidence file.
     */
    function changeMetaEvidence(string calldata _metaEvidence) external onlyGovernor {
        metaEvidenceID += 1;
        emit MetaEvidence(metaEvidenceID, _metaEvidence);
    }

    /**
     * @notice Changes the terms of service for Realitio.
     * @param _termsOfService URI to the new Terms of Service file.
     */
    function changeTermsOfService(string calldata _termsOfService) external onlyGovernor {
        termsOfService = _termsOfService;
    }

    /**
     * @notice Requests arbitration for given question ID.
     * @dev Can be executed only if the contract has been initialized.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function requestArbitration(bytes32 _questionID, bytes32 _contestedAnswer) external payable onlyIfInitialized {
        Arbitration storage arbitration = arbitrations[_questionID];
        require(arbitration.status == Status.None, "Arbitration already requested");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value >= arbitrationCost, "Deposit value too low");

        arbitration.status = Status.Requested;
        arbitration.requester = msg.sender;
        arbitration.deposit = msg.value;

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationRequest.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, _contestedAnswer, msg.sender);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit ArbitrationRequested(_questionID, _contestedAnswer, msg.sender);
    }

    /**
     * @notice Requests arbitration for given question ID.
     * @param _questionID The ID of the question.
     */
    function acknowledgeArbitration(bytes32 _questionID) external override onlyHomeProxy {
        Arbitration storage arbitration = arbitrations[_questionID];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        if (arbitration.deposit >= arbitrationCost) {
            try
                arbitrator.createDispute{value: arbitrationCost}(NUMBER_OF_CHOICES_FOR_ARBITRATOR, arbitratorExtraData)
            returns (uint256 disputeID) {
                disputeIDToQuestionID[disputeID] = _questionID;

                // At this point, arbitration.deposit is guaranteed to be greater than or equal to the arbitration cost.
                uint256 remainder = arbitration.deposit - arbitrationCost;

                arbitration.status = Status.Created;
                arbitration.deposit = 0;

                if (remainder > 0) {
                    arbitration.requester.send(remainder);
                }

                emit ArbitrationCreated(_questionID, disputeID);
                emit Dispute(arbitrator, disputeID, metaEvidenceID, uint256(_questionID));
            } catch {
                arbitration.status = Status.Failed;
                emit ArbitrationFailed(_questionID);
            }
        } else {
            arbitration.status = Status.Failed;
            emit ArbitrationFailed(_questionID);
        }
    }

    /**
     * @notice Cancels the arbitration.
     * @param _questionID The ID of the question.
     */
    function cancelArbitration(bytes32 _questionID) external override onlyHomeProxy {
        Arbitration storage arbitration = arbitrations[_questionID];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");

        arbitration.requester.send(arbitration.deposit);

        delete arbitrations[_questionID];

        emit ArbitrationCanceled(_questionID);
    }

    /**
     * @notice Cancels the arbitration in case the dispute could not be created.
     * @param _questionID The ID of the question.
     */
    function handleFailedDisputeCreation(bytes32 _questionID) external onlyIfInitialized {
        Arbitration storage arbitration = arbitrations[_questionID];
        require(arbitration.status == Status.Failed, "Invalid arbitration status");

        arbitration.requester.send(arbitration.deposit);

        delete arbitrations[_questionID];

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationFailure.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit ArbitrationCanceled(_questionID);
    }

    /**
     * @notice Allows to submit evidence for a particular question.
     * @param _questionID The ID of the arbitration related to the question.
     * @param _evidenceURI Link to evidence.
     */
    function submitEvidence(bytes32 _questionID, string calldata _evidenceURI) external {
        Arbitration storage arbitration = arbitrations[_questionID];
        require(arbitration.status == Status.Created, "The status should be Created.");

        if (bytes(_evidenceURI).length > 0) {
            emit Evidence(arbitrator, uint256(_questionID), msg.sender, _evidenceURI);
        }
    }

    /**
     * @notice Rules a specified dispute.
     * @dev Note that 0 is reserved for "Unable/refused to arbitrate" and we map it to `bytes32(-1)` which has a similar connotation in Realitio.
     * @param _disputeID The ID of the dispute in the ERC792 arbitrator.
     * @param _ruling The ruling given by the arbitrator.
     */
    function rule(uint256 _disputeID, uint256 _ruling) external override onlyArbitrator {
        bytes32 questionID = disputeIDToQuestionID[_disputeID];
        Arbitration storage arbitration = arbitrations[questionID];
        require(arbitration.status == Status.Created, "Invalid arbitration status");

        delete arbitrations[questionID];
        delete disputeIDToQuestionID[_disputeID];

        // Realitio ruling is shifted by 1 compared to Kleros.
        // For example, jurors refusing to rule is `0` on Kleros, but uint(-1) on Realitio.
        // The line below could be written more explicitly as:
        //     bytes32(_ruling == 0 ? uint256(-1) : _ruling - 1)
        // But the way it is written saves some gas.
        bytes32 answer = bytes32(_ruling - 1);

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationAnswer.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, questionID, answer);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit Ruling(arbitrator, _disputeID, _ruling);
    }

    /**
     * @notice Gets the fee to create a dispute.
     * @return The fee to create a dispute.
     */
    function getDisputeFee(bytes32 questionID) external view override returns (uint256) {
        return arbitrator.arbitrationCost(arbitratorExtraData);
    }
}
