// @deprecated Use buildPlatePrompt from architecturalPlate.ts instead.
// This module is kept for backwards compatibility with existing imports
// (PlateSubject type, parseSubjectFromPrompt, composePlatePrompt).
// composePlatePrompt now delegates to the Architectural Botanical Study Plate template.

import { buildPlatePrompt, type Moment } from "./architecturalPlate";

// @deprecated Retained only so legacy imports don't break.
export const PLATE_TEMPLATE = "";

export interface PlateSubject {
  commonName: string;
  binomial: string;
  description: string;
  specimenNote?: string;
}

function inferMoment(note: string | undefined): Moment {
  const n = (note ?? "").toLowerCase();
  if (!n) return "hook";
  if (/\bre[-\s]?hook\b/.test(n)) return "rehook";
  if (/\bdangle\s*(2|two)\b/.test(n)) return "dangle_2";
  if (/\bdangle\s*(1|one)\b/.test(n)) return "dangle_1";
  if (/\bverified\s*truth\b/.test(n) || /\bpayoff\b/.test(n)) return "verified_truth";
  if (/\bclose\b/.test(n)) return "close";
  if (/\bhook\b/.test(n)) return "hook";
  return "hook";
}

function subjectToString(subject: PlateSubject): string {
  const parts: string[] = [];
  if (subject.commonName?.trim()) parts.push(subject.commonName.trim());
  if (subject.binomial?.trim()) parts.push(`(${subject.binomial.trim()})`);
  let line = parts.join(" ");
  if (subject.description?.trim()) line += ` — ${subject.description.trim()}`;
  if (subject.specimenNote?.trim()) line += `. Hero specimen: ${subject.specimenNote.trim()}`;
  return line.trim();
}

export function composePlatePrompt(
  subject: PlateSubject,
  momentNote?: string,
): string {
  const moment = inferMoment(momentNote);
  return buildPlatePrompt(subjectToString(subject), moment);
}

// Best-effort extraction of subject fields from an existing prompt string.
export function parseSubjectFromPrompt(prompt: string): PlateSubject {
  const grab = (re: RegExp) => {
    const m = prompt.match(re);
    return m?.[1]?.trim() ?? "";
  };
  return {
    commonName: grab(/Common name:\s*(.+)/i),
    binomial: grab(/Latin binomial:\s*(.+)/i),
    description: grab(/Short description:\s*([\s\S]+?)(?:\n\s*-\s|\n\n|$)/i),
    specimenNote: grab(/Hero specimen:\s*([\s\S]+?)(?:\n\s*-\s|\n\n|$)/i),
  };
}
