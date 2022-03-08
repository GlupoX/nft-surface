import { useState } from "react";
import { ethers } from "ethers";

import { chainParams } from "@lib/chain-spec.js";
import {
	isTransactionMined,
	contractCall_mint,
	contractCall_mintAtPrice
} from "@lib/ethereum-interact.js";

import styles from '@components/Nft.module.css'

export default function Mint({
	context,
	nft,
	doConnectWallet,
	walletAddress,
	setOwner,
	setNotify,
	setTx,
	forceRender,
	contractAddress,
	chainId }) {

	const [connecting, setConnecting] = useState();
	const [specialPrice, setSpecialPrice] = useState("");
	const [specialSignature, setSpecialSignature] = useState("");
	const [expanded, setExpanded] = useState();

	const dislayMintPrice = (nft.mintPrice || context.baseMintPrice).toString();

	const expand = (evt) => {
		evt.preventDefault();
		setExpanded(true);
	}

	const doMint = async (e) => {
		if (!window.ethereum) return;
		setNotify("confirmation_pending");
		setConnecting(true);
		if (!walletAddress) await doConnectWallet();

		const price = (specialPrice || nft.mintPrice || "").toString();
		const signature = (specialSignature || nft.signature).toString();

		try {
			const { tx, error } = price ?
				await contractCall_mintAtPrice(context, nft, price, signature, contractAddress, chainId) :
				await contractCall_mint(context, nft, contractAddress, chainId)
			if (tx) {
				setTx(tx);
				setNotify("tx_pending");
				const txReceipt = await isTransactionMined(tx.hash, chainId)
				if (txReceipt) {
					setNotify("tx_succeded");
					setOwner(walletAddress);
					forceRender(Math.random())
				} else {
					setNotify("tx_failed");
				}
			} else {
				setNotify(error.includes("insufficient funds") ? "insufficient_funds" : error);
			}
		} catch (error) {
			setNotify(error.message);
		}
		setConnecting(false);
	};

	return <>
		<div>This NFT is available for minting</div>
		{!expanded &&
			<div>
				<span>Price : </span>
				<span className={styles.nftPriceETH}>
					{dislayMintPrice === "0" ?
						"FREE" :
						`${ethers.utils.formatEther(dislayMintPrice)} ${chainParams(chainId).nativeCurrency.symbol}`
					}
				</span>
				<span className={styles.nftPriceGas}>{" + gas fee"}</span>
				{dislayMintPrice !== "0" &&
					<div className={styles.nftPriceGas}>
						<a href="" onClick={expand} title="Apply a special minting price. Requires a valid signature.">I have a specially signed price</a>
					</div>
				}
			</div>
		}
		{expanded &&
			<form>
				<div>
					{"Price: "}
					<input
						autoFocus
						disabled={connecting}
						type="string"
						value={specialPrice}
						onChange={e => setSpecialPrice(e.target.value)}
					/>
					<span className={styles.nftPriceGas}>{" + gas fee"}</span>
					<div>
					</div>
					{" Signature: "}
					<input
						className={styles.bigInput}
						disabled={connecting}
						type="string"
						value={specialSignature}
						onChange={e => setSpecialSignature(e.target.value)}
					/>
				</div>
			</form>
		}
		<button
			onClick={doMint}
			disabled={(expanded && (!specialSignature || !specialPrice)) || connecting || !window.ethereum}>
			Mint this NFT
		</button>
	</>
}