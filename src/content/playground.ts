export type PlaygroundItem = { title: string; description: string; status: "In progress" | "Live"; href?: string };

export const playground: PlaygroundItem[] = [
  { title: "Mini game", description: "A small game you can finish in a minute.", status: "In progress" },
];
