
async function test() {
    console.log("Fetching Showdown Pokedex...");
    const res = await fetch('https://play.pokemonshowdown.com/data/pokedex.json');
    const data = await res.json();
    
    // Showdown usa nombres sin guiones ni espacios
    const feraligatrMega = data['feraligatrmega'];
    console.log("Feraligatr Mega in Showdown:", JSON.stringify(feraligatrMega, null, 2));

    const froslassMega = data['froslassmega'];
    console.log("Froslass Mega in Showdown:", JSON.stringify(froslassMega, null, 2));
}

test();
