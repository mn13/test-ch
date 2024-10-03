import { toBech32 } from '@cosmjs/encoding';
import { EncodeObject, TxBodyEncodeObject, makeAuthInfoBytes, makeSignDoc } from '@cosmjs/proto-signing';
import { cosmos, ethermint, getSigningWardenClientOptions, google, warden } from '@wardenprotocol/wardenjs';
import { HDNodeWallet } from 'ethers';
import { ethers } from 'ethers';
import { Int53 } from '@cosmjs/math';

const { Any } = google.protobuf;
const PubKey = ethermint.crypto.v1.ethsecp256k1.PubKey;
const { TxBody, TxRaw, SignDoc } = cosmos.tx.v1beta1;
const { createRPCQueryClient } = warden.ClientFactory;
const { newSpace, updateSpace } = warden.warden.v1beta3.MessageComposer.withTypeUrl;
const { newTemplate } = warden.act.v1beta1.MessageComposer.withTypeUrl


const RPC_NODE_1 = "https://rpc.chiado.wardenprotocol.org/"
const RPC_NODE_2 = "https://rpc.chiado.wardenprotocol.org/"
const API_NODE_1 = "https://api.chiado.wardenprotocol.org/"
const API_NODE_2 = "https://api.chiado.wardenprotocol.org/"
const MNEMONIC = "exclude try nephew main caught favorite tone degree lottery device tissue tent ugly mouse pelican gasp lava flush pen river noise remind balcony emerge"
const CHAIN_ID = "chiado_10010-1"

interface ISigner {
    wallet: HDNodeWallet;
    account: string;
    signerPubKey: Uint8Array;
  }

async function main() {
  const signer = await newSigner(MNEMONIC);
  const signerNode_2 = await newSigner(MNEMONIC);
  const qq = (await query(RPC_NODE_1)).cosmos.auth.v1beta1;
  const { account } = await qq.account({ address: signer.account });
  let nonce = account!.sequence;

  //   // create space
  // const newSpaceMessage = newSpace({
  //   creator: signer.account,
  //   approveAdminTemplateId: 0n,
  //   rejectAdminTemplateId: 0n,
  //   approveSignTemplateId: 0n,
  //   rejectSignTemplateId: 0n,
  //   additionalOwners: [],
  // });
  // console.log("newSpaceMessage")
  // const spaceRes = await signAndBroadcast(signer, [newSpaceMessage], API_NODE_1, RPC_NODE_1, nonce, account.accountNumber);
  // nonce += 1n;
  // console.log("space", (await spaceRes.json()).tx_response.txhash)

  // // create template
  // const newTemplateMessage = newTemplate({
  //     creator: signer.account,
  //     name: 'My template',
  //     definition: `all([${signer.account}])`
  // });
  // await sleep(6000);
  // const templateRes = await signAndBroadcast(signer, [newTemplateMessage], API_NODE_1, RPC_NODE_1, nonce, account.accountNumber);
  // nonce += 1n;
  // console.log("template", (await templateRes.json()))
  
  // update space in cycle, 2 different endpoints parallel
  const q = (await query(RPC_NODE_1)).warden.warden.v1beta3;
  // let spaceNonce = 0n;
  while (true) {
    const spaces = await q.spaces();
    const spaceNonce = spaces.spaces[1].nonce;
    const templateId = spaceNonce % 2n ? 1n : 0n;
    const updateSpaceMessage = updateSpace({
      authority: signer.account,
      spaceId: 2n,
      approveAdminTemplateId: templateId,
      rejectAdminTemplateId: templateId,
      approveSignTemplateId: templateId,
      rejectSignTemplateId: templateId,
      nonce: spaceNonce
    });
      
    signAndBroadcast(signer, [updateSpaceMessage], templateId === 0n ? API_NODE_1 : API_NODE_2, templateId === 0n ? RPC_NODE_1 : RPC_NODE_2, nonce, account!.accountNumber);
    nonce += 1n;

    // const jsonResponse = await response.json()

    // console.log(jsonResponse.tx_response.txhash);
    // console.log(JSON.stringify(jsonResponses));

    // spaceNonce = spaceNonce + 1n;
  }
}

main().catch(console.error)

async function newSigner(mnemonic: string): Promise<ISigner> {
    const ethWallet = ethers.Wallet.fromPhrase(mnemonic);
    const ethAddress = ethWallet.address;
    const wardenAddress = toBech32("warden", ethers.getBytes(ethAddress));
    const pubkey = ethers.getBytes(ethWallet.publicKey);

    return {
      wallet: ethWallet,
      account: wardenAddress,
      signerPubKey: pubkey,
    };
}

async function signAndBroadcast(signer: ISigner, messages: EncodeObject[], apiURL: string, rpcURL: string, nonce: bigint, accountNumber: any) {
  //   const q = (await query(rpcURL)).cosmos.auth.v1beta1;
  // const { account } = await q.account({ address: signer.account });
  console.log("account!.sequence", nonce)
    const pubk = Any.fromPartial({
      typeUrl: PubKey.typeUrl,
      value: PubKey.encode({
        key: signer.signerPubKey,
      }).finish(),
    });

    const txBody = TxBody.fromPartial({
      messages: messages,
      memo: '',
    });

    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: '/cosmos.tx.v1beta1.TxBody',
      value: txBody,
    };

    const { registry } = getSigningWardenClientOptions();
    const txBodyBytes = registry.encode(txBodyEncodeObject);
    const gasLimit = Int53.fromString("100000000").toNumber();
    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey: pubk, sequence: nonce }],
      [{ denom: 'award', amount: "1000" }],
      gasLimit,
      undefined,
      undefined,
    );
    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, CHAIN_ID, Number(accountNumber));

    const signDocBytes = SignDoc.encode(signDoc).finish();
    const signatureRaw = signer.wallet.signingKey.sign(ethers.keccak256(signDocBytes));
    const signature = ethers.Signature.from(signatureRaw);
    const signatureRS = ethers.concat([signature.r, signature.s]);
    const signatureRSBytes = ethers.getBytes(signatureRS);

    const signedTx = TxRaw.encode(
      TxRaw.fromPartial({
        authInfoBytes: signDoc.authInfoBytes,
        bodyBytes: signDoc.bodyBytes,
        signatures: [signatureRSBytes],
      }),
    ).finish();

    return fetch(`${apiURL}/cosmos/tx/v1beta1/txs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_bytes: ethers.encodeBase64(signedTx),
        mode: 'BROADCAST_MODE_SYNC',
      }),
    });
}

async function query(rpcURL) {
    return await createRPCQueryClient({ rpcEndpoint: rpcURL });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))