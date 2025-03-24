const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toBigInt, ZeroAddress, zeroPadValue, toBeHex } = ethers;

const HASH_ZERO = zeroPadValue(toBeHex(0), 32);

let arbitrator;
let homeProxy;
let foreignProxy;
let realitio;

let governor;
let asker;
let answerer;
let requester;
let other;

const homeChainId = zeroPadValue(toBeHex(0), 32);
const foreignChainId = zeroPadValue(toBeHex(0), 32);

const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;

const arbitrationFee = ethers.parseEther("1");
const arbitratorExtraData = "0x00";
const metaEvidence = "ipfs/X";
const metadata = "ipfs/Y";

let questionId;
const question = "Whats the answer for everything in the universe?";
const currentAnswer = zeroPadValue(toBeHex(1), 32);
const otherAnswer = zeroPadValue(toBeHex(42), 32);

let requesterAddress;

describe("Cross-Chain Arbitration", () => {
  beforeEach("Setup contracts", async () => {
    [governor, asker, answerer, requester, other] = await ethers.getSigners();
    ({ arbitrator, realitio, foreignProxy, homeProxy } = await deployContracts(governor));
    requesterAddress = await requester.getAddress();
  });

  describe("Request Arbitration", () => {
    beforeEach("Create question and submit answer", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt)._questionId;

      await submitAnswer(questionId, currentAnswer, { maxPrevious: 0, value: 1 });
    });

    describe("When the user requests arbitration", () => {
      const maxPrevious = 1;

      it("should immediately notify Realitio of the arbitration request", async () => {
        const { txPromise } = await requestArbitration(questionId, { maxPrevious });

        await expect(txPromise)
          .to.emit(homeProxy, "RequestNotified")
          .withArgs(questionId, requesterAddress, maxPrevious);
        await expect(txPromise)
          .to.emit(realitio, "MockNotifyOfArbitrationRequest")
          .withArgs(questionId, requesterAddress);
      });

      it("should create the dispute after notifying Realitio of the arbitration request", async () => {
        await requestArbitration(questionId);

        const { txPromise } = await handleNotifiedRequest(questionId, requesterAddress);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
        await expect(txPromise).to.emit(foreignProxy, "Dispute").withArgs(arbitrator.target, "0", "0", questionId);
        await expect(txPromise).to.emit(arbitrator, "DisputeCreation");
      });
    });

    describe("When the user requests arbitration after the question received a new answer with a higher bond", () => {
      const maxPrevious = 1;

      beforeEach("Create question and submit answer", async () => {
        await submitAnswer(questionId, currentAnswer, { maxPrevious: 0, value: 1 });
        await submitAnswer(questionId, currentAnswer, { maxPrevious: 1, value: 2 });
      });

      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        const { txPromise } = await requestArbitration(questionId, { maxPrevious });

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, requesterAddress, maxPrevious, "Bond has changed");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await requestArbitration(questionId, { maxPrevious });

        const { txPromise } = await handleRejectedRequest(questionId, requesterAddress);

        await expect(txPromise).to.emit(homeProxy, "RequestCanceled");
        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCanceled");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("should reimbuser the requester", async () => {
        await requestArbitration(questionId, { maxPrevious });

        const oldBalance = await getBalance(requester);
        await handleRejectedRequest(questionId, requesterAddress);
        const newBalance = await getBalance(requester);
        expect(newBalance).to.equal(oldBalance + arbitrationFee, "Requester was not reimbursed correctly");
      });
    });

    describe("When the user request arbitration for an unanswered question #regression", () => {
      let unansweredQuestionId;
      const maxPrevious = 1;

      beforeEach("Create question and do not submit an answer", async () => {
        const askTx = await realitio.connect(asker).askQuestion(question);
        const askTxReceipt = await askTx.wait();
        unansweredQuestionId = getEventArgs("MockNewQuestion", askTxReceipt)._questionId;
      });

      it("should reject the arbitration request and not notify Realitio", async () => {
        const { txPromise } = await requestArbitration(unansweredQuestionId, { maxPrevious });

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(unansweredQuestionId, requesterAddress, maxPrevious, "Question not answered");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });
    });

    describe("When the requester contests a finalized question", () => {
      const maxPrevious = 1;

      beforeEach("Finalize the question", async () => {
        await finalizeQuestion(questionId);
      });

      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        const { txPromise } = await requestArbitration(questionId, { maxPrevious });

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, requesterAddress, maxPrevious, "Invalid question status");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await requestArbitration(questionId, { maxPrevious });

        const { txPromise } = await handleRejectedRequest(questionId, requesterAddress);

        await expect(txPromise).to.emit(homeProxy, "RequestCanceled");
        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCanceled");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("should reimbuser the requester", async () => {
        await requestArbitration(questionId, { maxPrevious });

        const oldBalance = await getBalance(requester);
        await handleRejectedRequest(questionId, requesterAddress);
        const newBalance = await getBalance(requester);
        expect(newBalance).to.equal(oldBalance + arbitrationFee, "Requester was not reimbursed correctly");
      });
    });

    describe("When arbitration cost changes between the arbitration request and acknowledgement", () => {
      const maxPrevious = 1;
      let oldArbitrationFee;
      let newArbitrationFee;

      beforeEach("Request arbitration", async () => {
        oldArbitrationFee = await arbitrator.arbitrationCost(arbitratorExtraData);
        await requestArbitration(questionId, currentAnswer, { maxPrevious });
      });

      describe("When arbitration cost decreases", () => {
        beforeEach("Change arbitration cost", async () => {
          newArbitrationFee = arbitrationFee / toBigInt(2);
          await setArbitrationCost(newArbitrationFee);
        });

        it("Should create the dispute", async () => {
          const { txPromise } = await handleNotifiedRequest(questionId, requesterAddress);

          await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
          await expect(txPromise).to.emit(foreignProxy, "Dispute");
          await expect(txPromise).to.emit(arbitrator, "DisputeCreation");
        });

        it("Should send the remaining arbitration fee to the requester", async () => {
          const oldBalance = await getBalance(requester);
          await handleNotifiedRequest(questionId, requesterAddress);

          const expectedBalanceChange = oldArbitrationFee - newArbitrationFee;
          const newBalance = await getBalance(requester);
          expect(newBalance).to.equal(oldBalance + expectedBalanceChange, "Requester was not reimbursed correctly");
        });
      });

      describe("When arbitration cost increases", () => {
        beforeEach("Change arbitration cost", async () => {
          newArbitrationFee = arbitrationFee * toBigInt(2);
          await setArbitrationCost(newArbitrationFee);
        });

        it("Should abort the arbitration process", async () => {
          const { txPromise } = await handleNotifiedRequest(questionId, requesterAddress);

          await expect(txPromise).to.emit(foreignProxy, "ArbitrationFailed").withArgs(questionId, requesterAddress);
          await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
        });

        it("Should pass the message informing the dispute creation failed", async () => {
          await handleNotifiedRequest(questionId, requesterAddress);

          const { txPromise } = await handleFailedDisputeCreation(questionId, requesterAddress);

          await expect(txPromise).to.emit(homeProxy, "ArbitrationFailed").withArgs(questionId, requesterAddress);
          await expect(txPromise).to.emit(realitio, "MockCancelArbitrationRequest").withArgs(questionId);
        });

        it("Should reimburse the requester of the paid amount", async () => {
          await handleNotifiedRequest(questionId, requesterAddress);          

          const oldBalance = await getBalance(requester);
          await handleFailedDisputeCreation(questionId, requesterAddress);
          const newBalance = await getBalance(requester);
          expect(newBalance).to.equal(oldBalance + arbitrationFee, "Requester was not reimbursed correctly");
        });
      });
    });
  });

  describe("Arbitrator provide ruling", () => {
    const maxPrevious = 1;
    let disputeId;
    

    beforeEach("Create question, submit answer and request arbitration", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt)._questionId;

      await submitAnswer(questionId, currentAnswer, { maxPrevious: 0, value: 1 });
      await requestArbitration(questionId, { maxPrevious });
      await handleNotifiedRequest(questionId, requesterAddress);

      disputeId = (await foreignProxy.queryFilter(foreignProxy.filters.ArbitrationCreated(questionId)))[0]?.args._disputeID;
    });

    it("Should pass the message with the ruling when the arbitrator rules", async () => {
      const ruling = normalizeRuling(otherAnswer); // rules in favor of the requester
      const { txPromise } = await rule(disputeId, ruling);

      await expect(txPromise).to.emit(homeProxy, "ArbitratorAnswered").withArgs(questionId, otherAnswer);
    });

    it("Should notify Realitio of the answer given by the arbitrator when the home proxy reports the answer", async () => {
      const ruling = normalizeRuling(currentAnswer); // rules in favor of the original answer
      await rule(disputeId, ruling);

      const { txPromise } = await reportArbitrationAnswer(questionId);
      await expect(txPromise).to.emit(realitio, "MockFinalize").withArgs(questionId, currentAnswer);
    });
  });

  describe("When arbitration requests are issued at the same time", () => {
    const maxPrevious = 1;
    let otherAddress;

    beforeEach("Create question and submit answer", async () => {
      otherAddress = await other.getAddress();

      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt)._questionId;

      await submitAnswer(questionId, currentAnswer, { maxPrevious: 0, value: 1 });
    });

    it("Should allow requests for different answers to enter the sytem", async () => {
      const req1 = await requestArbitration(questionId, { maxPrevious });
      const req2 = await requestArbitration(questionId, { maxPrevious, signer: other });

      await expect(req1.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, requesterAddress, maxPrevious);
      await expect(req2.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, otherAddress, maxPrevious);
    });

    it("Should accept only the request regarding the current answer", async () => {
      const req1 = await requestArbitration(questionId, { maxPrevious });
      const req2 = await requestArbitration(questionId, { maxPrevious, signer: other });

      await expect(req1.txPromise)
        .to.emit(homeProxy, "RequestNotified")
        .withArgs(questionId, requesterAddress, maxPrevious);

      await expect(req2.txPromise)
        .to.emit(homeProxy, "RequestRejected")
        .withArgs(questionId, otherAddress, maxPrevious, "Invalid question status");
    });

    it("Should not allow multiple requests from the same user", async () => {
      const req1 = await requestArbitration(questionId, { maxPrevious });
      const req2 = await requestArbitration(questionId, { maxPrevious });

      await expect(req1.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, requesterAddress, maxPrevious);
      await expect(req2.txPromise).to.be.revertedWith("Arbitration already requested");
    });
  });

  describe("When an arbitration request has already been accepted for a given question", () => {
    beforeEach("Create question, submit answer, request arbitration and acknowlege it", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt)._questionId;

      await submitAnswer(questionId, currentAnswer, { maxPrevious: 0, value: 1 });
      await requestArbitration(questionId, requesterAddress);
      await handleNotifiedRequest(questionId, requesterAddress);
    });

    it("Should not allow other arbitration requests for the same question", async () => {
      const { txPromise } = await requestArbitration(questionId, requesterAddress);

      await expect(txPromise).to.be.revertedWith("Dispute already created");
    });
  });

  async function deployContracts(signer) {
    const Arbitrator = await ethers.getContractFactory("MockArbitrator", signer);
    const arbitrator = await Arbitrator.deploy(String(arbitrationFee));

    const AMB = await ethers.getContractFactory("MockAMB", signer);
    const amb = await AMB.deploy();

    const Realitio = await ethers.getContractFactory("MockRealitio", signer);
    const realitio = await Realitio.deploy();

    const ForeignProxy = await ethers.getContractFactory("RealitioForeignProxyGnosis", signer);
    const HomeProxy = await ethers.getContractFactory("RealitioHomeProxyGnosis", signer);

    const address = await signer.getAddress();
    const nonce = await signer.getNonce();

    const homeProxyAddress = ethers.getCreateAddress({
      from: address,
      nonce: nonce + 1, // Add 1 since homeProxy deployment will be after foreignProxy
    });

    const foreignProxy = await ForeignProxy.deploy(
      arbitrator.target,
      arbitratorExtraData,
      metaEvidence,
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier,
      homeProxyAddress,
      homeChainId,
      amb.target
    );

    const homeProxy = await HomeProxy.deploy(realitio.target, metadata, foreignProxy.target, foreignChainId, amb.target);

    return {
      amb,
      arbitrator,
      realitio,
      foreignProxy,
      homeProxy,
    };
  }

  async function submitAnswer(questionId, answer, { maxPrevious = 1, value = 2, signer = answerer } = {}) {
    return await submitTransaction(realitio.connect(signer).submitAnswer(questionId, answer, maxPrevious, { value }));
  }

  async function requestArbitration(questionId, { maxPrevious = 1, signer = requester } = {}) {
    return await submitTransaction(
      foreignProxy.connect(signer).requestArbitration(questionId, maxPrevious, { value: arbitrationFee })
    );
  }

  async function setArbitrationCost(cost, { signer = governor } = {}) {
    return await submitTransaction(arbitrator.connect(signer).setArbitrationCost(cost));
  }

  async function finalizeQuestion(questionId, { signer = governor } = {}) {
    return await submitTransaction(realitio.connect(signer).finalizeQuestion(questionId));
  }

  async function handleNotifiedRequest(questionId, requester, { signer = governor } = {}) {
    return await submitTransaction(homeProxy.connect(signer).handleNotifiedRequest(questionId, requester));
  }

  async function handleFailedDisputeCreation(questionId, requester, { signer = governor } = {}) {
    return await submitTransaction(foreignProxy.connect(signer).handleFailedDisputeCreation(questionId, requester));
  }

  async function handleRejectedRequest(questionId, requester, { signer = governor } = {}) {
    return await submitTransaction(homeProxy.connect(signer).handleRejectedRequest(questionId, requester));
  }

  async function rule(disputeID, ruling, { signer = governor } = {}) {
    return await submitTransaction(arbitrator.connect(signer).rule(disputeID, ruling));
  }

  async function reportArbitrationAnswer(questionId, { signer = governor } = {}) {
    return await submitTransaction(
      homeProxy.connect(signer).reportArbitrationAnswer(questionId, HASH_ZERO, HASH_ZERO, ZeroAddress)
    );
  }

  async function submitTransaction(txPromise) {
    try {
      const tx = await txPromise;
      const receipt = await tx.wait();

      return { txPromise, tx, receipt };
    } catch (err) {
      return { txPromise };
    }
  }

  async function getBalance(account) {
    return account.provider.getBalance(await account.getAddress());
  }

  function getEventArgs(eventName, receipt) {
    const eventLog = receipt.logs.find(log => log.fragment?.name === eventName);
    if (!eventLog) {
      throw new Error(`Event ${eventName} not emitted in the transaction`);
    }
  
    return eventLog.args;
  }

  function normalizeRuling(answer) {
    return toBigInt(answer) + 1n;
  }
});
