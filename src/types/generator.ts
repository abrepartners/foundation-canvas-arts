export type ThumbnailMode = 'light' | 'dark';

export interface GeneratorInput {
  botanicalSubject: string;
  claimToVerify: string;
  thumbnailMode: ThumbnailMode;
}

export interface GeneratorOutput {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  part2Hook: string;
}
