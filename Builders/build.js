import { buildIconLibrary } from "./build-icon-library.js";
import { buildGridIconThemes } from "./build-grid-icon-themes.js";
import { buildFeaturesList } from "./build-features-list.js";


async function main() {
    buildFeaturesList("./src/Features");
    buildGridIconThemes("./src/Utilities/Buttons", "grid-icon-base.css", "grid-icon.css");
    await buildIconLibrary('./src/Utilities/Icons');
}

main();