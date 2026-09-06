import { TopicDefinitionSchema, type RecipeShot, type TopicDefinition } from "@/lib/episodeSchema";

const shot = (
  id: string,
  label: string,
  stageType: RecipeShot["stageType"],
  botanicalStage: string,
  start: number,
  end: number,
  action: RecipeShot["action"],
  narration: string,
  captions: string[],
  startAssetSlot: string,
  endAssetSlot: string | undefined,
  visualDirection: string,
  gateIds: string[],
): RecipeShot => ({
  id, label, stageType, botanicalStage, start, end, action, narration, captions,
  startAssetSlot, ...(endAssetSlot ? { endAssetSlot } : {}), visualDirection, gateIds,
});

const peanut = TopicDefinitionSchema.parse({
  id: "peanut",
  commonName: "Peanut",
  scientificName: "Arachis hypogaea",
  aliases: ["peanut", "peanuts", "groundnut", "arachis hypogaea"],
  facts: [
    "The yellow flower forms above ground while the pod develops below ground.",
    "After fertilization, a reproductive peg grows down and enters the soil.",
    "The peg tip turns horizontally before the ovary enlarges into a pod.",
    "Darkness supports pod formation after the peg enters the soil.",
    "The ovary becomes the pod and its ovules become the edible seeds.",
  ],
  sources: [
    {
      title: "USDA Agricultural Research Service — Peanuts 101: The Basics, page 5",
      url: "https://www.ars.usda.gov/southeast-area/dawson-ga/national-peanut-research-laboratory/docs/peanuts-101-the-basics/page-5/",
      supports: ["above-ground bloom", "peg growth into soil", "below-ground pod development"],
    },
    {
      title: "Annals of Botany — Pod formation and its geotropic orientation in the peanut",
      url: "https://cris.huji.ac.il/en/publications/pod-formation-and-its-geotropic-orientation-in-the-peanut-arachis/",
      supports: ["darkness in pod formation", "horizontal and diageotropic pod orientation"],
    },
    {
      title: "USDA Agricultural Research Service — Pollination Handbook",
      url: "https://www.ars.usda.gov/SP2UserFiles/Place/53420300/OnlinePollinationHandbook.pdf",
      supports: ["four-leaflet peanut leaves", "peanut flower anatomy", "pollination biology"],
    },
  ],
  orderedStages: ["bloom", "peg", "soil entry", "horizontal turn", "pod development", "seed development", "maturity"],
  gates: {
    anatomy: ["Each compound leaf has four leaflets.", "Pods enlarge only at the reproductive peg tip."],
    counts: ["The hero pod contains exactly two edible seeds."],
    connections: ["The peg remains connected to its above-ground flower origin.", "True roots remain visibly separate from pegs and pods."],
    order: ["Soil entry precedes the horizontal turn.", "The horizontal turn precedes pod swelling.", "Pod formation precedes seed filling."],
  },
  assetSlots: [
    { id: "hero_closed", label: "Closed hero pod", reuseMoments: ["hook"] },
    { id: "hero_open", label: "Open pod with two seeds", reuseMoments: ["close"] },
    { id: "yellow_bloom", label: "Yellow flower above ground", reuseMoments: ["dangle_1"] },
    { id: "peg_origin", label: "Fertilized flower and new peg", reuseMoments: ["rehook"] },
    { id: "peg_above_soil", label: "Peg approaching soil", reuseMoments: [] },
    { id: "peg_in_soil", label: "Peg just inside soil", reuseMoments: ["dangle_2"] },
    { id: "peg_turned", label: "Horizontal peg tip before swelling", reuseMoments: [] },
    { id: "immature_pod", label: "Small pod at peg tip", reuseMoments: [] },
    { id: "two_small_seeds", label: "Pod with two small seeds", reuseMoments: [] },
    { id: "two_mature_seeds", label: "Pod with two mature seeds", reuseMoments: ["verified_truth"] },
    { id: "plant_connections", label: "Whole plant with separate roots and pegs", reuseMoments: [] },
    { id: "mixed_stages", label: "Pods at different stages", reuseMoments: [] },
  ],
  shots: [
    shot("01", "The familiar ending", "hook", "maturity", 0, 3, "open", "You opened a flower's buried ending.", ["YOU OPENED", "A FLOWER'S", "BURIED ENDING"], "hero_closed", "hero_open", "Open one crisp pod in a locked macro frame; reveal exactly two seeds.", ["count.two_seeds"]),
    shot("02", "Above ground", "setup", "bloom", 3, 6, "pan", "It began as a yellow flower.", ["IT BEGAN", "AS A", "YELLOW FLOWER"], "yellow_bloom", undefined, "Match cut to the yellow bloom and drift downward toward its base.", ["anatomy.four_leaflets"]),
    shot("03", "The peg appears", "mechanism", "peg", 6, 10, "grow", "Fertilization drops its petals and produces a peg.", ["FERTILIZATION", "DROPS ITS PETALS", "AND PRODUCES", "A PEG"], "yellow_bloom", "peg_origin", "Keep the flower branch continuous as the reproductive peg emerges.", ["connection.flower_origin"]),
    shot("04", "Downward growth", "mechanism", "peg", 10, 14.5, "descend", "The peg drives its reproductive tip downward.", ["THE PEG", "DRIVES", "ITS REPRODUCTIVE TIP", "DOWNWARD"], "peg_origin", "peg_above_soil", "Track the same tip downward; roots remain motionless and separate.", ["connection.roots_separate"]),
    shot("05", "Soil entry", "mechanism", "soil entry", 14.5, 19, "enter", "That tip pierces soil and enters darkness.", ["THAT TIP", "PIERCES SOIL", "AND ENTERS", "DARKNESS"], "peg_above_soil", "peg_in_soil", "Show the peg physically crossing the soil horizon before any pod exists.", ["order.entry_before_turn"]),
    shot("06", "The sideways turn", "mechanism", "horizontal turn", 19, 24, "turn", "Underground, it turns horizontally before changing shape.", ["UNDERGROUND", "IT TURNS", "HORIZONTALLY", "BEFORE CHANGING SHAPE"], "peg_in_soil", "peg_turned", "Use a clean botanical cutaway; bend only the distal tip.", ["order.turn_before_swell"]),
    shot("07", "Pod development", "development", "pod development", 24, 28, "swell", "Only then does its ovary swell into a pod.", ["ONLY THEN", "DOES ITS OVARY", "SWELL", "INTO A POD"], "peg_turned", "immature_pod", "Enlarge one pod in place at the already-horizontal reproductive tip.", ["anatomy.distal_pod"]),
    shot("08", "Seed development", "development", "seed development", 28, 31, "fill", "Two ovules become the edible seeds.", ["TWO OVULES", "BECOME", "THE EDIBLE SEEDS"], "two_small_seeds", "two_mature_seeds", "Fill exactly two existing seed chambers without adding a third.", ["count.two_seeds"]),
    shot("09", "The food reveal", "payoff", "maturity", 31, 35.5, "hold", "That flower's ovary became the familiar peanut pod.", ["THAT FLOWER'S OVARY", "BECAME", "THE FAMILIAR", "PEANUT POD"], "hero_open", undefined, "Hold a photoreal macro cross-section with subtle parallax.", ["count.two_seeds"]),
    shot("10", "Trace the connection", "anatomy", "maturity", 35.5, 40, "trace", "Trace it upward: the pod reaches a flower branch.", ["TRACE IT", "UPWARD", "THE POD", "REACHES", "A FLOWER BRANCH"], "plant_connections", undefined, "Follow one continuous peg from pod to the spent-flower node.", ["connection.flower_origin"]),
    shot("11", "Roots versus pegs", "anatomy", "maturity", 40, 44, "compare", "The branching roots remain entirely separate.", ["THE BRANCHING ROOTS", "REMAIN", "ENTIRELY SEPARATE"], "plant_connections", undefined, "Hold a wide cutaway where roots and reproductive pegs are unmistakably distinct.", ["connection.roots_separate"]),
    shot("12", "Different stages", "payoff", "maturity", 44, 47.5, "pan", "Flowering weeks leave pods at different stages.", ["FLOWERING WEEKS", "LEAVE PODS", "AT DIFFERENT STAGES"], "mixed_stages", undefined, "Pan across immature and mature pods without synchronized popping.", ["order.mixed_stages"]),
    shot("13", "Return to the beginning", "loop", "maturity", 47.5, 52, "pan", "A flower above. A pod below. Open another peanut.", ["A FLOWER ABOVE", "A POD BELOW", "OPEN ANOTHER PEANUT"], "yellow_bloom", "hero_closed", "Dissolve back to the exact closed-pod opening frame for a matched loop.", ["loop.exact_endpoint"]),
  ],
});

const strawberry = TopicDefinitionSchema.parse({
  id: "strawberry",
  commonName: "Strawberry",
  scientificName: "Fragaria × ananassa",
  aliases: ["strawberry", "strawberries", "fragaria", "fragaria ananassa"],
  facts: [
    "The red flesh is enlarged receptacle tissue, not the flower's ovary wall.",
    "Each apparent seed on the surface is an achene, a separate dry fruit.",
    "Each achene contains one true seed.",
    "After pollination, the receptacle enlarges while the achenes remain on its surface.",
  ],
  sources: [
    {
      title: "NC State Extension Gardener Handbook — Botany",
      url: "https://content.ces.ncsu.edu/extension-gardener-handbook/3-botany",
      supports: ["accessory fruit anatomy", "receptacle tissue", "achenes as individual fruits"],
    },
    {
      title: "University of Connecticut Home & Garden Education Center — Strawberries",
      url: "https://homegarden.cahnr.uconn.edu/factsheets/strawberries/",
      supports: ["strawberry flowering", "fruit development", "ripening stages"],
    },
  ],
  orderedStages: ["bloom", "pollination", "petal fall", "receptacle growth", "green fruit", "ripening", "maturity"],
  gates: {
    anatomy: ["Surface achenes remain distinct from the enlarged receptacle.", "The green calyx stays attached at the stem end."],
    counts: ["Each visible achene contains one seed; no exact whole-fruit achene count is asserted."],
    connections: ["Achenes remain attached across the outside of the receptacle.", "The fruit remains connected through the flower stalk and calyx."],
    order: ["Pollination precedes receptacle enlargement.", "Green fruit precedes red ripening.", "Mature anatomy is revealed only after growth stages."],
  },
  assetSlots: [
    { id: "mature_whole", label: "Whole mature strawberry", reuseMoments: ["hook"] },
    { id: "bite_reveal", label: "Mature bite or cut reveal", reuseMoments: ["close"] },
    { id: "white_bloom", label: "White strawberry flower", reuseMoments: ["dangle_1"] },
    { id: "pollinated_bloom", label: "Pollinated flower", reuseMoments: ["rehook"] },
    { id: "petals_falling", label: "Flower after petal fall", reuseMoments: [] },
    { id: "small_receptacle", label: "Small green receptacle", reuseMoments: ["dangle_2"] },
    { id: "green_fruit", label: "Expanded green strawberry", reuseMoments: [] },
    { id: "pale_fruit", label: "Pale ripening strawberry", reuseMoments: [] },
    { id: "red_fruit", label: "Red ripe strawberry", reuseMoments: ["verified_truth"] },
    { id: "achene_macro", label: "Surface achene macro", reuseMoments: [] },
    { id: "mixed_stages", label: "Flowers and fruit at mixed stages", reuseMoments: [] },
  ],
  shots: [
    shot("01", "The outside fruit", "hook", "maturity", 0, 3, "hold", "You bite flower base, not ovary.", ["YOU BITE", "FLOWER BASE", "NOT OVARY"], "mature_whole", undefined, "Begin on a tactile macro of the familiar red fruit.", ["anatomy.receptacle"]),
    shot("02", "The flower", "setup", "bloom", 3, 6, "pan", "Its white flower reveals why.", ["ITS WHITE FLOWER", "REVEALS WHY"], "white_bloom", undefined, "Match cut to the flower and drift toward its center.", ["connection.flower_stalk"]),
    shot("03", "Pollination", "mechanism", "pollination", 6, 10, "hold", "Pollination starts tiny ovaries as separate fruits.", ["POLLINATION", "STARTS", "TINY OVARIES", "AS SEPARATE FRUITS"], "pollinated_bloom", undefined, "Use a stable macro where the many separate ovaries remain legible.", ["count.one_seed_each"]),
    shot("04", "Petal fall", "mechanism", "petal fall", 10, 14.5, "open", "Petals fall; the centre stays on its stalk.", ["PETALS FALL", "THE CENTRE", "STAYS", "ON ITS STALK"], "pollinated_bloom", "petals_falling", "Remove petals gradually without detaching the receptacle or calyx.", ["connection.flower_stalk"]),
    shot("05", "Receptacle growth", "mechanism", "receptacle growth", 14.5, 19, "swell", "Beneath them, the receptacle swells into flesh.", ["BENEATH THEM", "THE RECEPTACLE", "SWELLS", "INTO FLESH"], "petals_falling", "small_receptacle", "Enlarge the central receptacle while surface ovaries stay distinct.", ["order.pollination_before_growth"]),
    shot("06", "Green fruit", "development", "green fruit", 19, 24, "grow", "It grows green, carrying fruits on its surface.", ["IT GROWS", "GREEN", "CARRYING FRUITS", "ON ITS SURFACE"], "small_receptacle", "green_fruit", "Grow one green receptacle; keep the achenes distributed on its outside.", ["connection.achenes_surface"]),
    shot("07", "Color change", "development", "ripening", 24, 28, "ripen", "Ripening fades green to cream, then spreads red.", ["RIPENING", "FADES GREEN", "TO CREAM", "THEN SPREADS RED"], "green_fruit", "pale_fruit", "Change pigment gradually with locked anatomy and camera.", ["order.green_before_red"]),
    shot("08", "Ripe fruit", "development", "maturity", 28, 31, "ripen", "Flesh softens; its fruits stay separate.", ["FLESH SOFTENS", "ITS FRUITS", "STAY SEPARATE"], "pale_fruit", "red_fruit", "Complete ripening without absorbing or multiplying surface achenes.", ["anatomy.achenes"]),
    shot("09", "The achene", "anatomy", "maturity", 31, 35.5, "pan", "Each speck is a dry fruit called an achene.", ["EACH SPECK", "IS A", "DRY FRUIT", "CALLED AN ACHENE"], "achene_macro", undefined, "Push into one surface achene while preserving surrounding flesh texture.", ["anatomy.achenes"]),
    shot("10", "The true seed", "anatomy", "maturity", 35.5, 40, "open", "Open one achene: its true seed sits inside.", ["OPEN ONE ACHENE", "ITS TRUE SEED", "SITS INSIDE"], "achene_macro", "achene_section", "Open one achene in a clean botanical schematic; reveal one seed.", ["count.one_seed_each"]),
    shot("11", "What becomes flesh", "payoff", "maturity", 40, 44, "compare", "The red tissue holds many individual fruits.", ["THE RED TISSUE", "HOLDS", "MANY INDIVIDUAL FRUITS"], "bite_reveal", undefined, "Compare flesh and surface achenes in one restrained cutaway.", ["anatomy.receptacle"]),
    shot("12", "Overlapping stages", "payoff", "maturity", 44, 47.5, "pan", "One plant flowers while nearby strawberries ripen.", ["ONE PLANT", "FLOWERS", "WHILE NEARBY", "STRAWBERRIES RIPEN"], "mixed_stages", undefined, "Pan across one plant with blooms, green fruit, and ripe fruit.", ["order.mixed_stages"]),
    shot("13", "Return to the bite", "loop", "maturity", 47.5, 52, "pan", "Each bite holds fruits outside an enlarged flower base.", ["EACH BITE", "HOLDS FRUITS", "OUTSIDE", "AN ENLARGED", "FLOWER BASE"], "bite_reveal", "mature_whole", "Return to the exact opening strawberry frame for a matched loop.", ["loop.exact_endpoint"]),
  ],
});

export const BOTANICAL_TOPIC_REGISTRY: Readonly<Record<string, TopicDefinition>> = {
  [peanut.id]: peanut,
  [strawberry.id]: strawberry,
};

export function normalizeTopic(value: string): string {
  return value.trim().toLowerCase().replace(/[×x]/g, "x").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findTopicDefinition(query: string): TopicDefinition | undefined {
  const normalized = normalizeTopic(query);
  return Object.values(BOTANICAL_TOPIC_REGISTRY).find((topic) =>
    [topic.id, topic.commonName, topic.scientificName, ...topic.aliases]
      .map(normalizeTopic)
      .includes(normalized),
  );
}

export const CURATED_TOPICS = Object.values(BOTANICAL_TOPIC_REGISTRY).map(({ id, commonName, scientificName }) => ({
  id, commonName, scientificName,
}));
