const fs = require('fs')

let start = 1;
let stop = 107;

let out = [];

let id = start;
while (id <= stop) {
    let tmp = {
        tokenId: id,
        sourceImage: "images/Architecture_" + id + ".jpg",
        metadata: {
            creator: "GlupoX",
            collection: "Moloch",
            date: "2022",
            name: "Untitled " + id,
            description: "'Moloch! Moloch! Robot apartments! Invisible suburbs! Skeleton treasuries! Blind capitals! Demonic industries! Spectral nations! Invincible mad houses!' - A. Ginsberg, Howl",
            external_url: "https://glupox.com/nft/" + id
        }
    };
    out.unshift(tmp);
    id ++;
}

//console.log(out)
fs.writeFileSync('./generated.json', JSON.stringify(out, null, 2) , 'utf-8');

