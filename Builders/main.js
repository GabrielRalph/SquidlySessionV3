import { buildIconLibrary } from "./build-icon-library.js";
import { buildColorThemeLibrary } from "./create-color-theme-library.js";
import { createFeatureList } from "./create-features-list.js";


async function main() {
    createFeatureList("../src/Features");
    buildColorThemeLibrary();
    await buildIconLibrary('../src/Utilities/Icons');
}

main();