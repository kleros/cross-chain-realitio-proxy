// SPDX-License-Identifier: BUSL-1.1
// https://github.com/OffchainLabs/nitro-contracts/blob/08ac127e966fa87a4d5ba3d23cd3132b57701132/src/bridge/IBridge.sol
// interface is pruned for relevant function stubs

pragma solidity 0.8.25;

interface IBridge {
    function activeOutbox() external view returns (address);
}