// SPDX-License-Identifier: MIT
pragma solidity ^0.7.2;

interface IBridge {
    function homeProxy() external view returns (address);

    function onlyHomeProxy() external;

    function foreignProxy() external view returns (address);

    function onlyForeignProxy() external;

    function sendMessage(address _reciepent, bytes memory _data) external;
}
