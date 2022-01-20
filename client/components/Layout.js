import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '@components/Layout.module.css'
import Link from 'next/link'

import { chainParams, explorerAddressLink } from "@utils/chain-spec.js";

export default function Layout({ children, home, nft, context }) {
	const router = useRouter()

	const chainId = context.chainId;
	const creatorAddress = context.creatorAddress;

	return (
		<div className={styles.container}>
			<Head>
				<meta name="viewport" content="initial-scale=1.0, width=device-width" />
				<title key="title">{process.env.siteTitle}</title>
				<meta name="description" content={process.env.siteDescription} />

				<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
				<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
				<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
				<link rel="manifest" href="/site.webmanifest" />

				<meta name="twitter:card" content="summary_large_image" key="twcard" />
				<meta name="twitter:creator" content={process.env.twitterHandle} key="twhandle" />
				<meta property="og:title" content={process.env.siteTitle} key="ogtitle" />
				<meta property="og:description" content={process.env.siteDescription} key="ogdesc" />
				<meta property="og:site_name" content={process.env.creatorName} key="ogsitename" />
				<link href="https://fonts.googleapis.com/css?family=Cabin:400,700&display=swap" rel="stylesheet"></link>
			</Head>

			<header className={styles.header}>
				<h1>
					{router.pathname === "/" ?
						process.env.creatorName :
						<Link href="/"><a>{process.env.creatorName}</a></Link>
					}
					{" · "}
					{router.pathname === "/nft" ?
						"NFT Catalog" :
						<Link href="/nft"><a>NFT Catalog</a></Link>
					}
					{router.pathname === "/nft/[tokenId]" &&
						<span>{" · #"}{nft.tokenId}</span>
					}
				</h1>
			</header>

			<main>{children}</main>

			<footer className={styles.footer}>
				{context.chainId > 1 &&
					<div className={styles.alertIsTestnet}>{chainParams(chainId).chainName}</div>
				}

				<div>Artist {chainParams(chainId).nativeCurrency.symbol} address : {explorerAddressLink(chainId, creatorAddress)}</div>
			</footer>
		</div>
	)
}
