const boards = {
  east: ["syrup", "baratie", "cocoyasi", "loguetown"],
  grand: ["cape", "whiskey", "garden", "drum"],
  landmarks: ["alabasta", "sky", "water", "sunny"],
  justice: ["jaya", "longring", "enies", "farewell"],
  mist: ["thriller", "sabaody", "amazon", "impel"],
  reunion: ["marine", "reunion", "fishman", "punk"],
  newworld: ["dressrosa", "zou", "cake", "wano"],
  horizon: ["egghead", "elbaf"],
};

const filename = name => `chapter-board-${name}.webp`;
const wideBoards = [
  { name: "sandcloud", width: 1536, height: 1024, chapters: ["alabasta", "sky"] },
  { name: "canals", width: 2172, height: 724, chapters: ["water", "sunny"] },
];
export const CHAPTER_BOARDS = [...Object.keys(boards), ...wideBoards.map(board => board.name)].map(filename);
export const CHAPTER_ART = Object.fromEntries(Object.entries(boards).flatMap(([name, chapters]) =>
  chapters.map((id, tile) => {
    // All boards share a 3:2 canvas. Leave a small safety margin at tile edges.
    const x = tile % 2 * 768 + 8;
    const y = Math.floor(tile / 2) * 512 + 8;
    return [id, { file: filename(name), width: 1536, height: 1024, viewBox: `${x} ${y} 752 496` }];
  }),
));

export const CHAPTER_WIDE_ART = Object.fromEntries(wideBoards.flatMap(({ name, width, height, chapters }) =>
  chapters.map((id, row) => [
    id, { file: filename(name), width, height, viewBox: `4 ${row * height / 2 + 4} ${width - 8} ${height / 2 - 8}` },
  ]),
));
