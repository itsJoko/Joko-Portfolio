// Graphic design work, grouped into collections. The data (files, sizes, alt text) is generated:
// edit COLLECTIONS in scripts/build-graphics.mjs and run it. This file holds the types and the tabs.

export type GraphicImage = { src: string; width: number; height: number; alt: string };

export type GraphicSection = {
  label?: string;
  /** How many across in the viewer: 1 stacks full width. */
  cols: number;
  images: GraphicImage[];
};

export type GraphicCategory = "Branding" | "Pubmats" | "Posters" | "Print & merch" | "Infographics" | "Art";

export type GraphicCollection = {
  slug: string;
  title: string;
  category: GraphicCategory;
  summary: string;
  count: number;
  cover: GraphicImage;
  sections: GraphicSection[];
};

export { collections } from "./graphics.data";

/** Tab order on the Graphics page; a tab only shows when it has work. */
export const CATEGORIES: GraphicCategory[] = ["Branding", "Pubmats", "Posters", "Print & merch", "Infographics", "Art"];
