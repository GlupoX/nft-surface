import Head from 'next/head'
import Layout from '@components/Layout'
import Image from 'next/image'

import frontImage from '@public/frontpage-bg.jpg'

import { fetchCatalog } from "@utils/fetch-catalog.js";

export async function getStaticProps() {
	const catalog = await fetchCatalog();
	const context = catalog.context;

	return {
		props: { context }
	}
}

export default function Home(props) {
	return (
		<Layout context={props.context} home>
			<Head>
				{/* homepage meta */}
			</Head>

			<Image
				src={frontImage}
				placeholder="blur"
				alt="front image"
				priority />
		</Layout>
	)
}
