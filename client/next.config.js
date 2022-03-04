https://testnets.opensea.io/assets/<contractAddress>/603

module.exports = {
    env: {
      networkKey:       process.env.networkKey,
      catalogBase:      process.env.catalogBase,
      catalogFilename:  process.env.catalogFilename,
      creatorName:      process.env.creatorName,
      siteTitle:        process.env.siteTitle,
      siteDescription:  process.env.siteDescription,
      twitterHandle:    process.env.twitterHandle,
      ipfsGateway:      process.env.ipfsGateway
    },
    target: 'serverless'
  }