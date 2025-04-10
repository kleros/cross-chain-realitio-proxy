import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { toBigInt, ZeroAddress, zeroPadValue, toBeHex } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  AutoAppealableArbitrator, 
  MockRealitioHomeProxyArbitrum, 
  RealitioForeignProxyArbitrum, 
  MockRealitio, 
  MockInbox, 
  MockBridge, 
  MockOutbox 
} from "../typechain-types";

const arbitratorExtraData = "0x85";
const arbitrationCost = 1000;
const initialBond = 2000;
const appealCost = 5000;
const questionID = zeroPadValue(toBeHex(0), 32);
const answer = zeroPadValue(toBeHex(11), 32);
const arbitrationID = 0;
const surplusAmount = 20000; // Covers the gas price (gas limit * priceBid + ticketCost) and has some extra amount. Gas = 12500
const totalCost = 21000; // Arbitration cost + surplus

const L2_GAS_LIMIT = 500;
const gasPriceBid = 5;
const l2GasPrice = 12500; // See above how this value calculated

const ticketSubmissionCost = 10000;

const appealTimeOut = 180;
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;
const gasPrice = toBigInt(80000000n);
const MAX_ANSWER = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const maxPrevious = 2001;

const metaEvidence = "ipfs/X";
const metadata = "ipfs/Y";
const foreignChainId = 5;
const oneETH = ethers.parseEther("1");
const ZERO_HASH = zeroPadValue(toBeHex(0), 32);

let arbitrator: AutoAppealableArbitrator;
let homeProxy: MockRealitioHomeProxyArbitrum;
let foreignProxy: RealitioForeignProxyArbitrum;
let realitio: MockRealitio;
let mockInbox: MockInbox;
let mockBridge: MockBridge;
let mockOutbox: MockOutbox;

let governor: HardhatEthersSigner;
let requester: HardhatEthersSigner;
let crowdfunder1: HardhatEthersSigner;
let crowdfunder2: HardhatEthersSigner;
let answerer: HardhatEthersSigner;
let other: HardhatEthersSigner;

describe("Cross-chain arbitration with appeals", () => {
  beforeEach("initialize the contract", async function () {
    [governor, requester, crowdfunder1, crowdfunder2, answerer, other] = await ethers.getSigners();
    ({ arbitrator, realitio, foreignProxy, homeProxy, mockInbox, mockBridge, mockOutbox } = await deployContracts(
      governor
    ));

    // Create disputes so the index in tests will not be a default value.
    await arbitrator.connect(other).createDispute(42, arbitratorExtraData, { value: arbitrationCost });
    await arbitrator.connect(other).createDispute(4, arbitratorExtraData, { value: arbitrationCost });

    await realitio.setArbitrator(arbitrator.target);
    await realitio.connect(requester).askQuestion("text");
    await realitio.connect(answerer).submitAnswer(questionID, answer, initialBond, { value: initialBond });
  });

  it("Should correctly set the initial values", async () => {
    expect(await foreignProxy.arbitrator()).to.equal(arbitrator.target);
    expect(await foreignProxy.arbitratorExtraData()).to.equal(arbitratorExtraData);
    expect(await foreignProxy.inbox()).to.equal(mockInbox.target);
    expect(await foreignProxy.l2GasLimit()).to.equal(500);
    expect(await foreignProxy.gasPriceBid()).to.equal(5);
    expect(await foreignProxy.surplusAmount()).to.equal(20000);
    expect(await foreignProxy.homeProxy()).to.equal(homeProxy.target);
    expect(await foreignProxy.wNative()).to.equal(other);

    expect(await homeProxy.metadata()).to.equal(metadata);
    expect(await homeProxy.foreignChainId()).to.equal(zeroPadValue(toBeHex(5), 32));
    expect(await homeProxy.foreignProxy()).to.equal(foreignProxy.target);
    expect(await homeProxy.mockInbox()).to.equal(mockInbox.target);
    expect(await homeProxy.mockBridge()).to.equal(mockBridge.target);
    expect(await homeProxy.realitio()).to.equal(realitio.target);

    // 0 - winner, 1 - loser, 2 - loserAppealPeriod.
    const multipliers = await foreignProxy.getMultipliers();
    expect(multipliers[0]).to.equal(3000);
    expect(multipliers[1]).to.equal(7000);
    expect(multipliers[2]).to.equal(5000);

    expect(await mockOutbox.sender()).to.equal(homeProxy.target);
    expect(await mockBridge.outbox()).to.equal(mockOutbox.target);

    expect(await mockInbox.bridge()).to.equal(mockBridge.target);
    expect(await mockInbox.submissionFee()).to.equal(10000);
  });

  it("Should set correct values when requesting arbitration and fire the event", async () => {
    await expect(
      foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: arbitrationCost })
    ).to.be.revertedWith("Deposit value too low");

    const requesterAddress = await requester.getAddress();
    await expect(foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost }))
      .to.emit(mockInbox, "TicketSent")
      .withArgs(
        homeProxy.target,
        0,
        ticketSubmissionCost,
        requesterAddress,
        requesterAddress,
        L2_GAS_LIMIT,
        gasPriceBid
      )
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(0) // TicketID
      .to.emit(foreignProxy, "ArbitrationRequested")
      .withArgs(questionID, requesterAddress, maxPrevious);

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(1, "Incorrect status of the arbitration after creating a request");
    expect(arbitration[1]).to.equal(8500, "Deposit value stored incorrectly"); // Surplus (20000) + ArbCost (1000) - ArbitrumFee (10000 + 5*500).

    // Inbox acts as foreignProxyAlias here so it passes onlyForeignProxyAlias require
    await expect(mockInbox.connect(other).redeemTicket(0))
      .to.emit(realitio, "MockNotifyOfArbitrationRequest")
      .withArgs(questionID, requesterAddress)
      .to.emit(homeProxy, "RequestNotified")
      .withArgs(questionID, requesterAddress, maxPrevious);

    const request = await homeProxy.requests(questionID, requesterAddress);
    expect(request[0]).to.equal(2, "Incorrect status of the request in HomeProxy");
    expect(request[1]).to.equal(ZERO_HASH, "Answer should be empty");

    expect(await homeProxy.questionIDToRequester(questionID)).to.equal(
      requesterAddress,
      "Incorrect requester stored in home proxy"
    );
  });

  it("Should set correct values when requesting arbitration with custom parameters and fire the event", async () => {
    await expect(
      foreignProxy.connect(requester).requestArbitrationCustomParameters(questionID, maxPrevious, 5, 10, { value: arbitrationCost })
    ).to.be.revertedWith("Deposit value too low");

    const requesterAddress = await requester.getAddress();
    await expect(foreignProxy.connect(requester).requestArbitrationCustomParameters(questionID, maxPrevious, 5, 10, { value: totalCost }))
      .to.emit(mockInbox, "TicketSent")
      .withArgs(
        homeProxy.target,
        0,
        ticketSubmissionCost,
        requesterAddress,
        requesterAddress,
        5,
        10
      )
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(0) // TicketID
      .to.emit(foreignProxy, "ArbitrationRequested")
      .withArgs(questionID, requesterAddress, maxPrevious);

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(1, "Incorrect status of the arbitration after creating a request");
    expect(arbitration[1]).to.equal(8500, "Deposit value stored incorrectly"); // Surplus (20000) + ArbCost (1000) - ArbitrumFee (10000 + 5*500).

    // Inbox acts as foreignProxyAlias here so it passes onlyForeignProxyAlias require
    await expect(mockInbox.connect(other).redeemTicket(0))
      .to.emit(realitio, "MockNotifyOfArbitrationRequest")
      .withArgs(questionID, requesterAddress)
      .to.emit(homeProxy, "RequestNotified")
      .withArgs(questionID, requesterAddress, maxPrevious);

    const request = await homeProxy.requests(questionID, requesterAddress);
    expect(request[0]).to.equal(2, "Incorrect status of the request in HomeProxy");
    expect(request[1]).to.equal(ZERO_HASH, "Answer should be empty");

    expect(await homeProxy.questionIDToRequester(questionID)).to.equal(
      requesterAddress,
      "Incorrect requester stored in home proxy"
    );
  });

  it("Should not allow to request arbitration 2nd time", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });

    await expect(
      foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost })
    ).to.be.revertedWith("Arbitration already requested");
  });

  it("Should have correct balance after paying arbitration cost and arbitrum fee", async () => {
    const oldBalance = await getBalance(requester);

    const tx = await foreignProxy
      .connect(requester)
      .requestArbitration(questionID, maxPrevious, { gasPrice: gasPrice, value: totalCost });
    const txFee = (await tx.wait())!.gasUsed * gasPrice;

    const newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance - toBigInt(1000) - txFee - toBigInt(20000), // Subtract tx fee, arbitration cost and surplus. The leftover surplus will be reimbursed later
      "Requester was not reimbursed correctly"
    );
  });

  it("Check home proxy permissions", async () => {
    await expect(
      homeProxy.receiveArbitrationRequest(questionID, await requester.getAddress(), maxPrevious)
    ).to.be.revertedWith("Can only be called by foreign proxy");

    await expect(homeProxy.receiveArbitrationFailure(questionID, await requester.getAddress())).to.be.revertedWith(
      "Can only be called by foreign proxy"
    );

    await expect(homeProxy.receiveArbitrationAnswer(questionID, answer)).to.be.revertedWith(
      "Can only be called by foreign proxy"
    );
  });

  it("Check foreign proxy permissions", async () => {
    await expect(
      foreignProxy.receiveArbitrationAcknowledgement(questionID, await requester.getAddress())
    ).to.be.revertedWith("NOT_BRIDGE");

    await expect(
      foreignProxy.receiveArbitrationCancelation(questionID, await requester.getAddress())
    ).to.be.revertedWith("NOT_BRIDGE");
  });

  it("Should set correct values when acknowledging arbitration and create a dispute", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    const badMessage = "0xfa";
    await expect(mockBridge.connect(other).sendAsBridge(homeProxy.target, badMessage)).to.be.revertedWith(
      "Failed TxToL1"
    );

    await expect(homeProxy.connect(other).handleNotifiedRequest(questionID, await requester.getAddress()))
      .to.emit(homeProxy, "RequestAcknowledged")
      .withArgs(questionID, await requester.getAddress())
      .to.emit(arbitrator, "DisputeCreation")
      .withArgs(2, foreignProxy.target)
      .to.emit(foreignProxy, "ArbitrationCreated")
      .withArgs(questionID, await requester.getAddress(), 2)
      .to.emit(foreignProxy, "Dispute")
      .withArgs(arbitrator.target, 2, 0, 0);

    const request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(3, "Incorrect status of the request in HomeProxy");

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(2, "Incorrect status of the arbitration after acknowledging arbitration");
    expect(arbitration[1]).to.equal(0, "Deposit value should be empty");
    expect(arbitration[2]).to.equal(2, "Incorrect dispute ID");

    const disputeData = await foreignProxy.disputeIDToDisputeDetails(2);
    expect(disputeData[0]).to.equal(0, "Incorrect arbitration ID in disputeData");
    expect(disputeData[1]).to.equal(await requester.getAddress(), "Incorrect requester address in disputeData");

    expect(await foreignProxy.arbitrationIDToRequester(arbitrationID)).to.equal(
      await requester.getAddress(),
      "Incorrect requester address in the mapping"
    );
    expect(await foreignProxy.arbitrationIDToDisputeExists(arbitrationID)).to.equal(
      true,
      "Incorrect flag after creating a dispute"
    );

    expect(await foreignProxy.getNumberOfRounds(arbitrationID)).to.equal(
      1,
      "Incorrect number of rounds after dispute creation"
    );
    expect(await foreignProxy.externalIDtoLocalID(2)).to.equal(arbitrationID, "Incorrect externalIDtoLocalID value");

    const dispute = await arbitrator.disputes(2);
    expect(dispute[0]).to.equal(foreignProxy.target, "Incorrect arbitrable address");
    expect(dispute[1]).to.equal(MAX_ANSWER, "Incorrect number of choices");
    expect(dispute[2]).to.equal(1000, "Incorrect fees value stored");
  });

  it("Should not allow to receive the message from incorrect L2 sender", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    // Deliberately change outbox sender to see if the check in onlyL2Bridge modifier works.
    // Note that it want obtain the exact message during revert because of low level call
    await mockOutbox.setSender(await other.getAddress());

    await expect(
      homeProxy.connect(other).handleNotifiedRequest(questionID, await requester.getAddress())
    ).to.be.revertedWith("Failed TxToL1");
  });

  it("Should not be able to proccess the message twice", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await expect(
      foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost })
    ).to.be.revertedWith("Dispute already created");
  });

  it("Should not allow to handle request before ticket is redeemed", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });

    await expect(homeProxy.handleNotifiedRequest(questionID, await requester.getAddress())).to.be.revertedWith(
      "Invalid request status"
    );
  });

  it("Should reimburse after dispute creation in case of overpay", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: oneETH }); // Deliberately overpay
    await mockInbox.connect(other).redeemTicket(0);

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    const requesterDeposit = arbitration[1];
    expect(requesterDeposit).to.equal(oneETH - toBigInt(12500), "Incorrect deposit value"); //Ticket submission fee + gas limit * price bid = 10000 * 2500

    const oldBalance = await getBalance(requester);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    const newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance + requesterDeposit - toBigInt(arbitrationCost),
      "Requester was not reimbursed correctly"
    );
  });

  it("Should cancel arbitration correctly", async () => {
    await expect(homeProxy.handleRejectedRequest(questionID, await requester.getAddress())).to.be.revertedWith(
      "Invalid request status"
    );

    const badMaxPrevious = 11;
    await foreignProxy.connect(requester).requestArbitration(questionID, badMaxPrevious, { value: totalCost });

    await expect(mockInbox.connect(other).redeemTicket(0))
      .to.emit(homeProxy, "RequestRejected")
      .withArgs(questionID, await requester.getAddress(), badMaxPrevious, "Bond has changed");

    let request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(1, "Incorrect status of the request in HomeProxy after rejection");
    expect(await homeProxy.questionIDToRequester(questionID)).to.equal(
      ZeroAddress,
      "Requester address should be empty after rejection"
    );

    const oldBalance = await getBalance(requester);
    await expect(homeProxy.handleRejectedRequest(questionID, await requester.getAddress()))
      .to.emit(homeProxy, "RequestCanceled")
      .withArgs(questionID, await requester.getAddress())
      .to.emit(foreignProxy, "ArbitrationCanceled")
      .withArgs(questionID, await requester.getAddress());

    request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(0, "Status should be nullified in home proxy");

    const newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance + toBigInt(arbitrationCost + surplusAmount - 12500), // 12500 is Arbitrum fee
      "Requester was not reimbursed correctly"
    );

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(0, "Status should be empty");
    expect(arbitration[1]).to.equal(0, "Deposit should be empty");
    expect(arbitration[2]).to.equal(0, "Dispute id should be empty");
  });

  it("Should correctly handle failed dispute creation", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await expect(
      foreignProxy
        .connect(other)
        .handleFailedDisputeCreation(questionID, await requester.getAddress(), { value: totalCost })
    ).to.be.revertedWith("Invalid arbitration status");

    await arbitrator.setArbitrationPrice(8501); // Increase the cost so creation fails. 21000 was originally sent, 12500 taken as fee, so increased cost should be higher than 8500

    await expect(homeProxy.handleNotifiedRequest(questionID, await requester.getAddress()))
      .to.emit(foreignProxy, "ArbitrationFailed")
      .withArgs(questionID, await requester.getAddress());

    let arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(5, "Status should be Failed");

    const oldBalance = await getBalance(requester);

    await expect(
      foreignProxy
        .connect(other)
        .handleFailedDisputeCreation(questionID, await requester.getAddress(), { value: l2GasPrice })
    )
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(1)
      .to.emit(foreignProxy, "ArbitrationCanceled")
      .withArgs(questionID, await requester.getAddress())
      .to.emit(mockInbox, "TicketSent");

    await expect(mockInbox.connect(other).redeemTicket(1))
      .to.emit(realitio, "MockCancelArbitrationRequest")
      .withArgs(questionID)
      .to.emit(homeProxy, "ArbitrationFailed")
      .withArgs(questionID, await requester.getAddress());

    const newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance + toBigInt(arbitrationCost + surplusAmount - l2GasPrice),
      "Requester was not reimbursed correctly"
    ); // 8500

    arbitration = await foreignProxy.arbitrationRequests(0, await requester.getAddress());
    expect(arbitration[0]).to.equal(5, "Status should be Failed");
    expect(arbitration[1]).to.equal(0, "Deposit should be empty");
    expect(arbitration[2]).to.equal(0, "Dispute id should be empty");

    const request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(0, "Status should be nullified in home proxy");
  });

  it("Should correctly handle failed dispute creation with custom parameters", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await expect(
      foreignProxy
        .connect(other)
        .handleFailedDisputeCreationCustomParameters(questionID, await requester.getAddress(), 5, 10, { value: totalCost })
    ).to.be.revertedWith("Invalid arbitration status");

    await arbitrator.setArbitrationPrice(8501); // Increase the cost so creation fails. 21000 was originally sent, 12500 taken as fee, so increased cost should be higher than 8500

    await expect(homeProxy.handleNotifiedRequest(questionID, await requester.getAddress()))
      .to.emit(foreignProxy, "ArbitrationFailed")
      .withArgs(questionID, await requester.getAddress());

    let arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(5, "Status should be Failed");

    const oldBalance = await getBalance(requester);
    const senderAddress = await other.getAddress();
  
    await expect(
      foreignProxy
        .connect(other)
        .handleFailedDisputeCreationCustomParameters(questionID, await requester.getAddress(), 5, 10, { value: l2GasPrice })
    )
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(1)
      .to.emit(foreignProxy, "ArbitrationCanceled")
      .withArgs(questionID, await requester.getAddress())
      .to.emit(mockInbox, "TicketSent")
      .withArgs(
        homeProxy.target,
        0,
        ticketSubmissionCost,
        senderAddress,
        senderAddress,
        5,
        10
      );

    await expect(mockInbox.connect(other).redeemTicket(1))
      .to.emit(realitio, "MockCancelArbitrationRequest")
      .withArgs(questionID)
      .to.emit(homeProxy, "ArbitrationFailed")
      .withArgs(questionID, await requester.getAddress());

    const newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance + toBigInt(arbitrationCost + surplusAmount - l2GasPrice),
      "Requester was not reimbursed correctly"
    ); // 8500

    arbitration = await foreignProxy.arbitrationRequests(0, await requester.getAddress());
    expect(arbitration[0]).to.equal(5, "Status should be Failed");
    expect(arbitration[1]).to.equal(0, "Deposit should be empty");
    expect(arbitration[2]).to.equal(0, "Dispute id should be empty");

    const request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(0, "Status should be nullified in home proxy");
  });

  it("Should correctly reimburse the overpay when handling failed dispute", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await arbitrator.setArbitrationPrice(8501); // Increase the cost so creation fails.
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await expect(
      foreignProxy
        .connect(other)
        .handleFailedDisputeCreation(questionID, await requester.getAddress(), { value: l2GasPrice - 1 })
    ).to.be.revertedWith("Should cover arbitrum fee");

    const oldBalance = await getBalance(other);
    const tx = await foreignProxy
      .connect(other)
      .handleFailedDisputeCreation(questionID, await requester.getAddress(), { gasPrice: gasPrice, value: oneETH });
    const txFee = (await tx.wait())!.gasUsed * gasPrice;

    const newBalance = await getBalance(other);
    expect(newBalance).to.equal(
      oldBalance - toBigInt(l2GasPrice) - txFee, // Take only gas price for L2 and txfee
      "Caller was not reimbursed correctly"
    );
  });

  it("Should handle the ruling correctly", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    const arbAnswer = zeroPadValue(toBeHex(7), 32);

    await expect(
      foreignProxy.connect(other).relayRule(questionID, await requester.getAddress(), { value: l2GasPrice })
    ).to.be.revertedWith("Dispute not resolved");

    await expect(arbitrator.giveRuling(2, 8)).to.emit(foreignProxy, "Ruling").withArgs(arbitrator.target, 2, 8);

    let arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(3, "Status should be Ruled");
    expect(arbitration[3]).to.equal(8, "Stored answer is incorrect");

    await expect(homeProxy.reportArbitrationAnswer(questionID, ZERO_HASH, ZERO_HASH, ZeroAddress)).to.be.revertedWith(
      "Arbitrator has not ruled yet"
    );

    await expect(foreignProxy.connect(other).relayRule(questionID, await requester.getAddress(), { value: l2GasPrice }))
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(1)
      .to.emit(mockInbox, "TicketSent")
      .to.emit(foreignProxy, "RulingRelayed")
      .withArgs(questionID, arbAnswer);

    await expect(mockInbox.connect(other).redeemTicket(1))
      .to.emit(homeProxy, "ArbitratorAnswered")
      .withArgs(questionID, arbAnswer);

    arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(4, "Status should be Relayed");

    let request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(4, "Status should be Ruled");
    expect(request[1]).to.equal(arbAnswer, "Incorrect answer stored");

    await expect(homeProxy.reportArbitrationAnswer(questionID, ZERO_HASH, ZERO_HASH, ZeroAddress))
      .to.emit(realitio, "MockFinalize")
      .withArgs(questionID, arbAnswer)
      .to.emit(homeProxy, "ArbitrationFinished")
      .withArgs(questionID);

    request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(5, "Status should be Finished");
  });

  it("Should handle the ruling correctly with custom parameters", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    const arbAnswer = zeroPadValue(toBeHex(7), 32);

    await expect(
      foreignProxy.connect(other).relayRuleCustomParameters(questionID, await requester.getAddress(), 5, 10, { value: l2GasPrice })
    ).to.be.revertedWith("Dispute not resolved");

    await expect(arbitrator.giveRuling(2, 8)).to.emit(foreignProxy, "Ruling").withArgs(arbitrator.target, 2, 8);

    let arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(3, "Status should be Ruled");
    expect(arbitration[3]).to.equal(8, "Stored answer is incorrect");

    await expect(homeProxy.reportArbitrationAnswer(questionID, ZERO_HASH, ZERO_HASH, ZeroAddress)).to.be.revertedWith(
      "Arbitrator has not ruled yet"
    );

    const senderAddress = await other.getAddress();
  
    await expect(foreignProxy.connect(other).relayRuleCustomParameters(questionID, await requester.getAddress(), 5, 10, { value: l2GasPrice }))
      .to.emit(foreignProxy, "RetryableTicketCreated")
      .withArgs(1)
      .to.emit(mockInbox, "TicketSent")
      .withArgs(
        homeProxy.target,
        0,
        ticketSubmissionCost,
        senderAddress,
        senderAddress,
        5,
        10
      )
      .to.emit(foreignProxy, "RulingRelayed")
      .withArgs(questionID, arbAnswer);

    await expect(mockInbox.connect(other).redeemTicket(1))
      .to.emit(homeProxy, "ArbitratorAnswered")
      .withArgs(questionID, arbAnswer);

    arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(4, "Status should be Relayed");

    let request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(4, "Status should be Ruled");
    expect(request[1]).to.equal(arbAnswer, "Incorrect answer stored");

    await expect(homeProxy.reportArbitrationAnswer(questionID, ZERO_HASH, ZERO_HASH, ZeroAddress))
      .to.emit(realitio, "MockFinalize")
      .withArgs(questionID, arbAnswer)
      .to.emit(homeProxy, "ArbitrationFinished")
      .withArgs(questionID);

    request = await homeProxy.requests(questionID, await requester.getAddress());
    expect(request[0]).to.equal(5, "Status should be Finished");
  });

  it("Should correctly reimburse the overpay when ruling is relayed", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());
    await arbitrator.giveRuling(2, 8);

    await expect(
      foreignProxy.connect(other).relayRule(questionID, await requester.getAddress(), { value: l2GasPrice - 1 })
    ).to.be.revertedWith("Should cover arbitrum fee");

    const oldBalance = await getBalance(other);
    const tx = await foreignProxy
      .connect(other)
      .relayRule(questionID, await requester.getAddress(), { gasPrice: gasPrice, value: oneETH });
    const txFee = (await tx.wait())!.gasUsed * gasPrice;

    const newBalance = await getBalance(other);
    expect(newBalance).to.equal(
      oldBalance - toBigInt(l2GasPrice) - txFee, // Take only gas price for L2 and txfee
      "Caller was not reimbursed correctly"
    );
  });

  it("Should correctly fund an appeal and fire the events", async () => {
    let oldBalance;
    let newBalance;
    let txFundAppeal;
    let fundingStatus;
    let tx;
    let txFee;
    let roundInfo;
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);

    await expect(foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 11, { value: 1000 })).to.be.revertedWith(
      "No dispute to appeal."
    );

    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    // Check that can't fund the dispute that is not appealable.
    await expect(foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 11, { value: 1000 })).to.be.revertedWith(
      "Appeal period is over."
    );

    await arbitrator.giveAppealableRuling(2, 14, appealCost, appealTimeOut);

    // loserFee = appealCost + (appealCost * loserMultiplier / 10000) // 5000 + 5000 * 7/10 = 8500
    // 1st Funding ////////////////////////////////////
    oldBalance = await getBalance(crowdfunder1);
    txFundAppeal = foreignProxy
      .connect(crowdfunder1)
      .fundAppeal(arbitrationID, 533, { gasPrice: gasPrice, value: appealCost }); // This value doesn't fund fully.
    tx = await txFundAppeal;
    txFee = (await tx.wait())!.gasUsed * gasPrice;

    newBalance = await getBalance(crowdfunder1);
    expect(newBalance).to.equal(
      oldBalance - toBigInt(5000) - txFee,
      "The crowdfunder has incorrect balance after the first funding"
    );

    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 0);
    expect(roundInfo[1]).to.equal(0, "FeeRewards value should be 0 after partial funding");

    fundingStatus = await foreignProxy.getFundingStatus(arbitrationID, 0, 533);
    expect(fundingStatus[0]).to.equal(5000, "Incorrect amount of paidFees registered after the first funding");
    expect(fundingStatus[1]).to.equal(false, "The answer should not be fully funded after partial funding");

    await expect(txFundAppeal)
      .to.emit(foreignProxy, "Contribution")
      .withArgs(arbitrationID, 0, 533, await crowdfunder1.getAddress(), 5000); // ArbitrationID, NbRound, Ruling, Sender, Amount

    // 2nd Funding ////////////////////////////////////
    oldBalance = newBalance;
    txFundAppeal = foreignProxy
      .connect(crowdfunder1)
      .fundAppeal(arbitrationID, 533, { gasPrice: gasPrice, value: oneETH }); // Overpay to check that it's handled correctly.
    tx = await txFundAppeal;
    txFee = (await tx.wait())!.gasUsed * gasPrice;
    newBalance = await getBalance(crowdfunder1);
    expect(newBalance).to.equal(
      oldBalance - toBigInt(3500) - txFee,
      "The crowdfunder has incorrect balance after the second funding"
    );

    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 0);
    expect(roundInfo[0][0]).to.equal(8500, "Incorrect paidFees value of the fully funded answer");
    expect(roundInfo[1]).to.equal(8500, "Incorrect feeRewards value after the full funding");
    expect(roundInfo[2][0]).to.equal(533, "Incorrect funded answer stored");

    fundingStatus = await foreignProxy.getFundingStatus(arbitrationID, 0, 533);
    expect(fundingStatus[0]).to.equal(8500, "Incorrect amount of paidFees registered after the second funding");
    expect(fundingStatus[1]).to.equal(true, "The answer should be fully funded after the second funding");

    const contributionInfo = await foreignProxy.getContributionsToSuccessfulFundings(
      arbitrationID,
      0,
      await crowdfunder1.getAddress()
    );
    expect(contributionInfo[0][0]).to.equal(533, "Incorrect fully funded answer returned by contrbution info");
    expect(contributionInfo[1][0]).to.equal(8500, "Incorrect contribution value returned by contrbution info");

    expect(await foreignProxy.getNumberOfRounds(arbitrationID)).to.equal(1, "Number of rounds should not increase");

    await expect(txFundAppeal)
      .to.emit(foreignProxy, "Contribution")
      .withArgs(arbitrationID, 0, 533, await crowdfunder1.getAddress(), 3500)
      .to.emit(foreignProxy, "RulingFunded")
      .withArgs(arbitrationID, 0, 533);

    await expect(
      foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 533, { value: appealCost })
    ).to.be.revertedWith("Appeal fee is already paid.");
  });

  it("Should correctly create and fund subsequent appeal rounds", async () => {
    let roundInfo;
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 21, appealCost, appealTimeOut);

    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 14, { value: 8500 });
    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 21, { value: 5000 }); // Winner appeal fee is 6500 full.

    expect(await foreignProxy.getNumberOfRounds(arbitrationID)).to.equal(1, "Number of rounds should not increase");

    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 21, { value: 1500 });

    expect(await foreignProxy.getNumberOfRounds(arbitrationID)).to.equal(
      2,
      "Number of rounds should increase after two sides are fully funded"
    );

    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 0);
    expect(roundInfo[1]).to.equal(10000, "Incorrect feeRewards value after creating a 2nd round"); // 8500 + 6500 - 5000.

    await arbitrator.giveAppealableRuling(2, MAX_ANSWER, appealCost, appealTimeOut);

    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 0, { value: oneETH });

    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 1);
    expect(roundInfo[0][0]).to.equal(8500, "Incorrect paidFees value after funding 0 answer"); // total loser fee = 5000 + 5000 * 0.7
    expect(roundInfo[2][0]).to.equal(0, "0 answer was not stored correctly");

    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, MAX_ANSWER, { value: 6500 });

    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 1);
    expect(roundInfo[0][1]).to.equal(6500, "Incorrect paidFees value for 2nd crowdfunder");
    expect(roundInfo[1]).to.equal(10000, "Incorrect feeRewards value after creating a 3rd round"); // 8500 + 6500 - 5000.
    expect(roundInfo[2][1]).to.equal(MAX_ANSWER, "0 answer was not stored correctly");

    expect(await foreignProxy.getNumberOfRounds(arbitrationID)).to.equal(3, "Number of rounds should increase to 3");

    // Check that newly created round is empty.
    roundInfo = await foreignProxy.getRoundInfo(arbitrationID, 2);
    expect(roundInfo[1]).to.equal(0, "Incorrect feeRewards value in fresh round");
  });

  it("Should not fund the appeal after the timeout", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 21, appealCost, appealTimeOut);

    await time.increase(appealTimeOut / 2 + 1);

    // Loser.
    await expect(
      foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 533, { value: appealCost })
    ).to.be.revertedWith("Appeal period is over for loser");

    // Adding another half will cover the whole period.
    await time.increase(appealTimeOut / 2 + 1);

    // Winner.
    await expect(
      foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 21, { value: appealCost })
    ).to.be.revertedWith("Appeal period is over.");
  });

  it("Should correctly withdraw appeal fees if a dispute had winner/loser", async () => {
    let oldBalance1;
    let oldBalance2;
    let newBalance;
    let newBalance1;
    let newBalance2;
    const requesterAddress = await requester.getAddress();
    const crowdfunder1Address = await crowdfunder1.getAddress();
    const crowdfunder2Address = await crowdfunder2.getAddress();

    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 5, appealCost, appealTimeOut);

    // LoserFee = 8500, WinnerFee = 6500. AppealCost = 5000.
    // 0 Round.
    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 50, { value: 4000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 50, { value: oneETH });

    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 5, { value: 6000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 5, { value: 6000 });

    await arbitrator.giveAppealableRuling(2, 5, appealCost, appealTimeOut);

    // 1 Round.
    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 44, { value: 500 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 44, { value: 8000 });

    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 5, { value: 20000 });

    await arbitrator.giveAppealableRuling(2, 5, appealCost, appealTimeOut);

    // 2 Round.
    // Partially funded side should be reimbursed.
    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 41, { value: 8499 });

    // Winner doesn't have to fund appeal in this case but let's check if it causes unexpected behaviour.
    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 5, { value: oneETH });

    await time.increase(appealTimeOut + 1);

    await expect(foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 0, 50)).to.be.revertedWith(
      "Dispute not resolved"
    );

    await arbitrator.executeRuling(2);

    let ruling = await arbitrator.currentRuling(2);

    const arbitration = await foreignProxy.arbitrationRequests(0, requesterAddress);
    expect(arbitration[0]).to.equal(3, "Status should be Ruled");
    expect(arbitration[3]).to.equal(ruling, "Stored answer is incorrect");

    const oldBalance = await getBalance(requester);
    oldBalance1 = await getBalance(crowdfunder1);
    oldBalance2 = await getBalance(crowdfunder2);

    // Withdraw 0 round.
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 0, 50);

    newBalance = await getBalance(requester);
    expect(newBalance).to.equal(oldBalance, "The balance of the requester should stay the same (withdraw 0 round)");

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 0, 5);

    newBalance = await getBalance(requester);
    expect(newBalance).to.equal(
      oldBalance,
      "The balance of the requester should stay the same (withdraw 0 round from winning ruling)"
    );

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder1Address, 0, 50);

    newBalance1 = await getBalance(crowdfunder1);
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same (withdraw 0 round)"
    );

    await expect(foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder1Address, 0, 5))
      .to.emit(foreignProxy, "Withdrawal")
      .withArgs(arbitrationID, 0, 5, crowdfunder1Address, 769); // The reward is 769 = (500/6500 * 10000)

    newBalance1 = await getBalance(crowdfunder1);
    expect(newBalance1).to.equal(
      oldBalance1 + toBigInt(769),
      "The balance of the crowdfunder1 is incorrect after withdrawing from winning ruling 0 round"
    );

    oldBalance1 = newBalance1;

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder1Address, 0, 5);

    newBalance1 = await getBalance(crowdfunder1);
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same after withdrawing the 2nd time"
    );

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder2Address, 0, 5);

    newBalance2 = await getBalance(crowdfunder2);
    // 12 / 13 * 10000 = 9230
    expect(newBalance2).to.equal(
      oldBalance2 + toBigInt(9230),
      "The balance of the crowdfunder2 is incorrect (withdraw 0 round)"
    );

    oldBalance2 = newBalance2;

    let contributionInfo = await foreignProxy.getContributionsToSuccessfulFundings(
      arbitrationID,
      0,
      crowdfunder1Address
    );
    expect(contributionInfo[1][1]).to.equal(0, "Contribution of crowdfunder1 should be 0");
    contributionInfo = await foreignProxy.getContributionsToSuccessfulFundings(arbitrationID, 0, crowdfunder2Address);
    expect(contributionInfo[1][0]).to.equal(0, "Contribution of crowdfunder2 should be 0");

    // Withdraw 1 round.
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 1, 5);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 1, 44);

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder1Address, 1, 5);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder1Address, 1, 44);

    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder2Address, 1, 5);

    newBalance = await getBalance(requester);
    newBalance1 = await getBalance(crowdfunder1);
    newBalance2 = await getBalance(crowdfunder2);
    expect(newBalance).to.equal(oldBalance, "The balance of the requester should stay the same (withdraw 1 round)");
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same (withdraw 1 round)"
    );
    expect(newBalance2).to.equal(
      oldBalance2 + toBigInt(10000),
      "The balance of the crowdfunder2 is incorrect (withdraw 1 round)"
    );

    contributionInfo = await foreignProxy.getContributionsToSuccessfulFundings(arbitrationID, 1, crowdfunder2Address);
    expect(contributionInfo[1][0]).to.equal(0, "Contribution of crowdfunder2 should be 0 in 1 round");
    oldBalance2 = newBalance2;

    // Withdraw 2 round.
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, requesterAddress, 2, 41);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, crowdfunder2Address, 2, 5);

    newBalance = await getBalance(requester);
    newBalance2 = await getBalance(crowdfunder2);
    expect(newBalance).to.equal(
      oldBalance + toBigInt(8499),
      "The balance of the requester is incorrect (withdraw 2 round)"
    );
    expect(newBalance2).to.equal(
      oldBalance2 + toBigInt(6500),
      "The balance of the crowdfunder2 is incorrect (withdraw 2 round)"
    );

    contributionInfo = await foreignProxy.getContributionsToSuccessfulFundings(arbitrationID, 2, crowdfunder2Address);
    expect(contributionInfo[1][0]).to.equal(0, "Contribution of crowdfunder2 should be 0 in 2 round");
  });

  it("Should correctly withdraw appeal fees if the winner did not pay the fees in the round", async () => {
    let oldBalance;
    let newBalance;

    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 20, appealCost, appealTimeOut);

    // LoserFee = 8500. AppealCost = 5000.
    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 1, { value: 5000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 1, { value: 3500 });

    await foreignProxy.connect(crowdfunder2).fundAppeal(arbitrationID, 4, { value: 1000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 4, { value: 10000 });

    await arbitrator.giveAppealableRuling(2, 20, appealCost, appealTimeOut);

    await time.increase(appealTimeOut + 1);

    await arbitrator.executeRuling(2);

    oldBalance = await getBalance(requester);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, await requester.getAddress(), 0, 1);
    newBalance = await getBalance(requester);
    expect(newBalance).to.equal(oldBalance + toBigInt(3529), "The balance of the requester is incorrect"); // 5000 * 12000 / 17000.

    oldBalance = await getBalance(crowdfunder1);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, await crowdfunder1.getAddress(), 0, 1);
    newBalance = await getBalance(crowdfunder1);
    expect(newBalance).to.equal(oldBalance + toBigInt(2470), "The balance of the crowdfunder1 is incorrect (1 ruling)"); // 3500 * 12000 / 17000.

    oldBalance = newBalance;
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, await crowdfunder1.getAddress(), 0, 4);
    newBalance = await getBalance(crowdfunder1);
    expect(newBalance).to.equal(oldBalance + toBigInt(5294), "The balance of the crowdfunder1 is incorrect (4 ruling)"); // 7500 * 12000 / 17000.

    oldBalance = await getBalance(crowdfunder2);
    await foreignProxy.withdrawFeesAndRewards(arbitrationID, await crowdfunder2.getAddress(), 0, 4);
    newBalance = await getBalance(crowdfunder2);
    expect(newBalance).to.equal(oldBalance + toBigInt(705), "The balance of the crowdfunder2 is incorrect"); // 1000 * 12000 / 17000.
  });

  it("Should correctly withdraw appeal fees for multiple rounds", async () => {
    let oldBalance;
    let newBalance;

    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 3, appealCost, appealTimeOut);

    // LoserFee = 8500. AppealCost = 5000.
    // WinnerFee = 6500.
    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 1, { value: 5000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 1, { value: 3500 });

    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 3, { value: 1000 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 3, { value: 10000 });

    await arbitrator.giveAppealableRuling(2, 3, appealCost, appealTimeOut);

    await foreignProxy.connect(requester).fundAppeal(arbitrationID, 41, { value: 17 });
    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 45, { value: 22 });

    await time.increase(appealTimeOut + 1);

    await arbitrator.executeRuling(2);

    oldBalance = await getBalance(requester);

    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await requester.getAddress(), 1);
    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await requester.getAddress(), 3);
    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await requester.getAddress(), 41);

    newBalance = await getBalance(requester);
    // 1000 * 10000 / 6500 + 17 = 1538 + 17
    expect(newBalance).to.equal(oldBalance + toBigInt(1555), "The balance of the requester is incorrect");

    oldBalance = await getBalance(crowdfunder1);
    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await crowdfunder1.getAddress(), 1);
    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await crowdfunder1.getAddress(), 3);
    await foreignProxy.withdrawFeesAndRewardsForAllRounds(arbitrationID, await crowdfunder1.getAddress(), 45);

    newBalance = await getBalance(crowdfunder1);
    // 5500 * 10000 / 6500 + 22 = 8461 + 22
    expect(newBalance).to.equal(oldBalance + toBigInt(8483), "The balance of the crowdfunder1 is incorrect");
  });

  it("Should switch the ruling if the loser paid appeal fees while winner did not", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await arbitrator.giveAppealableRuling(2, 14, appealCost, appealTimeOut);

    await foreignProxy.connect(crowdfunder1).fundAppeal(arbitrationID, 50, { value: oneETH });
    await time.increase(appealTimeOut + 1);
    await arbitrator.executeRuling(2);

    const arbitration = await foreignProxy.arbitrationRequests(arbitrationID, await requester.getAddress());
    expect(arbitration[0]).to.equal(3, "Status should be Ruled");
    expect(arbitration[3]).to.equal(50, "The answer should be 50");
  });

  it("Should correctly submit evidence", async () => {
    await foreignProxy.connect(requester).requestArbitration(questionID, maxPrevious, { value: totalCost });
    await mockInbox.connect(other).redeemTicket(0);
    await homeProxy.handleNotifiedRequest(questionID, await requester.getAddress());

    await expect(foreignProxy.connect(other).submitEvidence(arbitrationID, "text"))
      .to.emit(foreignProxy, "Evidence")
      .withArgs(arbitrator.target, arbitrationID, await other.getAddress(), "text");
  });

  async function deployContracts(signer: HardhatEthersSigner) {
    const Arbitrator = await ethers.getContractFactory("AutoAppealableArbitrator", signer);
    const arbitrator = await Arbitrator.deploy(String(arbitrationCost));

    const MockOutbox = await ethers.getContractFactory("MockOutbox", signer);
    const mockOutbox = await MockOutbox.deploy();

    const MockBridge = await ethers.getContractFactory("MockBridge", signer);
    const mockBridge = await MockBridge.deploy(mockOutbox.target);

    const MockInbox = await ethers.getContractFactory("MockInbox", signer);
    const mockInbox = await MockInbox.deploy(mockBridge.target, ticketSubmissionCost);

    const Realitio = await ethers.getContractFactory("MockRealitio", signer);
    const realitio = await Realitio.deploy();

    const ForeignProxy = await ethers.getContractFactory("RealitioForeignProxyArbitrum", signer);
    const HomeProxy = await ethers.getContractFactory("MockRealitioHomeProxyArbitrum", signer);

    const address = await signer.getAddress();
    const nonce = await signer.getNonce();

    const homeProxyAddress = ethers.getCreateAddress({
      from: address,
      nonce: nonce + 1, // Add 1 since homeProxy deployment will be after foreignProxy
    });

    const foreignProxy = await ForeignProxy.deploy(
      other, // Use other address as placeholder for wNative
      arbitrator.target,
      arbitratorExtraData,
      metaEvidence,
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier,
      homeProxyAddress,
      mockInbox.target,
      surplusAmount,
      [L2_GAS_LIMIT, gasPriceBid]
    );

    const homeProxy = await HomeProxy.deploy(
      realitio.target,
      metadata,
      foreignProxy.target,
      foreignChainId,
      mockInbox.target,
      mockBridge.target
    );

    await mockOutbox.setSender(homeProxy.target);

    return {
      arbitrator,
      realitio,
      foreignProxy,
      homeProxy,
      mockInbox,
      mockBridge,
      mockOutbox,
    };
  }

  async function getBalance(account: HardhatEthersSigner) {
    return account.provider.getBalance(await account.getAddress());
  }
});
