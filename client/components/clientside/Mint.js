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
	const [price, setPrice] = useState("");
	const [priceSignature, setPriceSignature] = useState("");
	const [expanded, setExpanded] = useState();

	const expand = (evt) => {
		evt.preventDefault();
		setExpanded(true);
	}

	const doMint = async (e) => {
		if (!window.ethereum) return;
		setNotify("confirmation_pending");
		setConnecting(true);
		if (!walletAddress) await doConnectWallet();
		try {
			const { tx, error } = priceSignature ?
				await contractCall_mintAtPrice(context, nft, ethers.utils.parseEther(price), priceSignature, contractAddress, chainId) :
				await contractCall_mint(context, nft, contractAddress, chainId);

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
					{context.mintPrice === "0" ?
						"FREE" :
						`${ethers.utils.formatEther(context.mintPrice)} ${chainParams(chainId).nativeCurrency.symbol}`
					}
				</span>
				<span className={styles.nftPriceGas}>{" + gas fee"}</span>
				{context.mintPrice !== "0" &&
					<div className={styles.nftPriceGas}>
						<a href="" onClick={expand} title="Apply a special price. Requires a valid signature.">Use a signed price</a>
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
						value={price}
						onChange={e => setPrice(e.target.value)}
					/>
					<span className={styles.nftPriceGas}>{" + gas fee"}</span>
					<div>
					</div>
					{" Signature: "}
					<input
						className={styles.bigInput}
						disabled={connecting}
						type="string"
						value={priceSignature}
						onChange={e => setPriceSignature(e.target.value)}
					/>
				</div>
			</form>
		}
		<button onClick={doMint} disabled={connecting || !window.ethereum}>
			Mint this NFT
		</button>
	</>
}