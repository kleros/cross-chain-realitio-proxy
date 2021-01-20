import { S3 } from "aws-sdk";

const s3 = new S3();

export async function getDefaultAccount(web3) {
  const firstAccount = web3.eth.accounts.wallet[0];

  if (firstAccount) {
    return firstAccount;
  }

  const privateKey = await getPrivateKey();

  const accountInfo = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(accountInfo);

  return accountInfo;
}

async function getPrivateKey() {
  const data = await s3
    .getObject({
      Bucket: process.env.BOTS_PRIVATE_KEYS_BUCKET,
      Key: process.env.BOTS_PRIVATE_KEYS_FILE,
    })
    .promise();

  const { privateKey } = JSON.parse(data.Body?.toString("utf8") ?? "{}");
  return privateKey;
}
