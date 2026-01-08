export interface BotanicalScript {
  hook: string;
  dangle1: string;
  rehook: string;
  dangle2: string;
  payoff: string;
  verifiedTruth: string;
  close: string;
}

export interface BotanicalContent {
  plant: string;
  fact: string;
  script: BotanicalScript;
  thumbnailPrompt: string;
  caption: string;
  part2Hook: string;
}
