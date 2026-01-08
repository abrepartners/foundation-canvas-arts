export type ThumbnailMode = "Light" | "Dark";

export interface GeneratorInputs {
  botanicalSubject: string;
  claimToVerify: string;
  thumbnailMode: ThumbnailMode;
}

export interface GeneratedContent {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  part2Hook: string;
  thumbnailMode: ThumbnailMode;
}
