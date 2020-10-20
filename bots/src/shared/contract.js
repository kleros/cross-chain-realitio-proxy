import {getDefaultAccount} from "./account";

export async function getContract(web3, abi, address) {
  const account = await getDefaultAccount(web3);
  return new web3.eth.Contract(abi, address, {from: account.address});
}
