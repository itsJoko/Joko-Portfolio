/** The photo spot's poses: picked before a picture, played by Folio, and shared with the others on the island. */
export const POSES = [
  { id: "cheer", label: "Cheer" },
  { id: "wave", label: "Wave" },
  { id: "star", label: "Star jump" },
  { id: "point", label: "Point" },
] as const;
export type Pose = (typeof POSES)[number]["id"];
export const isPose = (v: unknown): v is Pose => POSES.some((p) => p.id === v);
