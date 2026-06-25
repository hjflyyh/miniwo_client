/** GameMifeng 气泡对话分类 */
export enum GameMifengDialogueCategory {
    NoSeeds = 'noSeeds',
    HasSeedsNotPlanted = 'hasSeedsNotPlanted',
    Growing = 'growing',
    NoNpcWorking = 'noNpcWorking',
    Harvestable = 'harvestable',
}

export const GAME_MIFENG_DIALOGUES: Record<GameMifengDialogueCategory, string[]> = {
    [GameMifengDialogueCategory.NoSeeds]: [
        'Buzz-buzz... my seed pouch is empty today~',
        'No seeds? Aww, my little pollen pockets feel so lonely!',
        'Could someone bring seeds? I promise to cheer the crops on!',
        'An empty bag makes one sad wittle bee.',
        'I will guard the fields, but seeds would be super buzz-tastic!',
    ],
    [GameMifengDialogueCategory.HasSeedsNotPlanted]: [
        'You have seeds! Pick a cozy plot and let us plant together~',
        'Those seeds are doing the idle dance—time to tuck them into soil!',
        'Buzz! I spotted seeds in your bag begging for a farm nap.',
        'So many empty plots, so many seeds... perfect match, right?',
        'Plant one tiny seed and I will throw a mini bee party!',
    ],
    [GameMifengDialogueCategory.Growing]: [
        'Shhh~ tiny sprouts are napping. Growing strong!',
        'Look look! The crops are stretching toward the sunshine!',
        'Buzzy busy fields! Something yummy is growing here~',
        'I will hum a lullaby so your crops grow extra sweet!',
        'Patience, patience~ good things sprout for bees who wait!',
    ],
    [GameMifengDialogueCategory.NoNpcWorking]: [
        'The farm feels quiet... no NPC helpers buzzing about!',
        'Anyone free to work the farm? This bee loves teamwork!',
        'Quiet fields today. A friendly NPC would brighten things up~',
        'I will do my best, but crops love having friends too!',
        'No farmhands on duty? Guess it is just you, me, and the soil!',
    ],
    [GameMifengDialogueCategory.Harvestable]: [
        'Yayyy! Golden crops are ready—sweet victory!',
        'Buzz buzz! Something smells perfectly ripe!',
        'Harvest time! My favorite kind of farm fireworks~',
        'Those crops are glowing... definitely ready to pick!',
        'Tingle-tingle! Ripe treasures waiting for gentle hands!',
    ],
};

export function pickRandomDialogue(
    category: GameMifengDialogueCategory,
    exclude?: string,
): string {
    const pool = GAME_MIFENG_DIALOGUES[category] ?? [];
    if (!pool.length) {
        return '';
    }
    let candidates = pool;
    if (exclude && pool.length > 1) {
        const filtered = pool.filter((line) => line !== exclude);
        if (filtered.length > 0) {
            candidates = filtered;
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}
