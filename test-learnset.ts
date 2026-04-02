
async function test() {
    const res = await fetch('https://play.pokemonshowdown.com/data/learnsets.json');
    const text = await res.text();
    const data = JSON.parse(text.replace(/^var \w+ = /i, '').replace(/;$/, ''));
    console.log("Froslass Mega Learnset:", data['froslassmega']?.learnset || "NOT FOUND");
    console.log("Charizard Mega X Learnset:", data['charizardmegax']?.learnset || "NOT FOUND");
}
test();
