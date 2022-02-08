import Head from 'next/head'
import Layout, { siteTitle } from '@components/Layout'
import Nft from '@components/Nft'
import { fetchCatalog } from "@lib/fetch-catalog.js";

export async function getStaticPaths() {
  const catalog = await fetchCatalog();
  const ids = catalog.NFTs.map((nft) => nft.tokenId.toString());
  const paths = ids.map(id => ({ params: { tokenId: id } }))

  return {
    paths,
    fallback: false
  }
}

export async function getStaticProps({ params }) {
  const catalog = await fetchCatalog();
  const ids = catalog.NFTs.map((nft) => nft.tokenId.toString());
  const length = ids.length;
  const i = ids.findIndex((tokenId) => tokenId === params.tokenId);

  return {
    props: {
      nft: catalog.NFTs[i],
      context: catalog.context,
      nav: {
        nextId: ids[(i + 1) % length],
        prevId: ids[(i + length - 1) % length]
      }
    }
  }
}

export default function NFT({ nft, context, nav }) {
  return (
    <Layout nft={nft} context={context} nav={nav}>
      <Head>
        <title key="title">{process.env.creatorName}{" | "}{nft.metadata.name}</title>
        <meta property="og:image" content={process.env.catalogBaseURL + "/" + nft.webOptimizedImage} key="ogimage" />
      </Head>
      <Nft nft={nft} context={context} />
    </Layout>
  )
}