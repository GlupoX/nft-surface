import dynamic from 'next/dynamic'
import Image from 'next/image'

const NftStatus = dynamic(
	() => import('../components/clientside/NftStatus'),
	{ ssr: false }
)

import styles from '@components/Nft.module.css'

export default function Nft({ nft, context }) {
	const contractAddress = context.contractAddress;
	const creatorAddress = context.creatorAddress;
	const chainId = context.chainId;
	const tokenId = nft.tokenId;
	const width = nft.metadata.width || 100;
	const height = nft.metadata.height || 100;
	const orient = width > height ? 'landscape' : 'portrait';

	return (
		<div className={styles.nft}>

			<div className={`${styles.nftImage} ${orient}`}>
				<Image
					src={process.env.catalogBase + "/" + nft.webOptimizedImage}
					width={width}
					height={height}
					placeholder={nft.placeholderImage ? "blur" : "empty"}
					blurDataURL={nft.placeholderImage}
					alt={nft.metadata.name}
					priority
					layout="responsive" />
			</div>

			<div className={styles.nftSections}>

				<div className={styles.nftSection}>

					<h1 className={styles.nftName}>{nft.metadata.name}</h1>
					<div className={styles.nftDetails}>
						<div>{nft.metadata.creator} {nft.metadata.date}</div>
						<div>Edition {nft.metadata.edition || "1 / 1"}</div>
						<div>{width}{" x "}{height}{" px"}</div>
						{nft.metadata.collection &&
							<div>Collection : {nft.metadata.collection || "1 / 1"}</div>
						}
						<div>{
							(nft.metadata.description + "").split("/n").map((para, index) =>
								<div key={index}>{para}</div>
							)
						}</div>
					</div>
				</div>

				<div className={styles.nftSection}>
					<NftStatus nft={nft} context={context} />
				</div>
			</div>
		</div>
	)
}