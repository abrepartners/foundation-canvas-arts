## Goal

Fix the caption template so every generated caption:

1. Starts with a **bold title line** (the attention-grabbing headline at the very top).
2. Always ends with the **5 hashtags** block (currently sometimes missing).

This applies to both newly generated content and the "Regenerate caption" button.

## Where the change lives

The caption spec is duplicated in three edge functions. All three must be updated identically so behavior matches whether the caption is generated fresh or regenerated:

- `supabase/functions/generate-botanical-content/index.ts`
- `supabase/functions/generate-trend-content/index.ts`
- `supabase/functions/regenerate-caption/index.ts`

## Spec changes (applied to all three)

Add a new **Section 0** at the top of the caption structure:

> **0. Bold title line.** A single short headline (4–10 words) that names the surprising angle of the post. Wrap it in `**double asterisks**` so it renders bold on platforms that support markdown and visually reads as a title on those that don't. No emojis. No trailing punctuation other than `.` or `?`. Followed by a blank line.

Strengthen the hashtag rule (Section 12) to prevent omission:

> Hashtags are **mandatory**. The caption is invalid without exactly 5 hashtag lines at the very end. If unsure, default to: `#botany`, `#plantscience`, `#plantfacts`, `#botanicalclassification`, plus one topic-specific tag.

Keep everything else (175–300 words, "This is why:" bullets, brand line, "Topics covered:", etc.) unchanged.

## Deploy

After the edits, redeploy the three functions:
`generate-botanical-content`, `generate-trend-content`, `regenerate-caption`.

## Out of scope

- No UI changes. `ContentSection` already renders the caption as preformatted text, so the `**bold**` markers will appear as-is in the app and render bold when pasted into TikTok/Instagram drafts that support it. Say so if you'd like a markdown renderer in the app instead — that would be a follow-up.
- No DB/schema changes.
- Existing saved captions are not backfilled; use "Regenerate caption" on any old item to upgrade it.  
  
  
ensure to follow this: and add it to your memory:  
When generating a TikTok or Instagram carousel draft, automatically generate an SEO-style caption that matches the educational botanical verification style.
  Caption goal:  
  Create a caption that explains the carousel topic in a clear, searchable, educational format. The caption should help the post rank for search terms while still sounding natural and human.
  Caption structure:
  1. Start with a strong hook that sounds surprising or slightly counterintuitive.
  2. Explain why the hook sounds wrong at first.
  3. Clarify the scientific or factual reason behind it.
  4. Use plain language, not academic wording.
  5. Include the core educational takeaway.
  6. Reinforce the difference between common understanding and scientific definition.
  7. Add a short recurring brand line near the end:  
  “My brother studies plants.  
  I verify the facts.”
  8. End with a simple promise of more verified explanations coming soon.
  9. Include a “Topics covered” section with searchable keyword phrases.
  10. End with relevant hashtags.
  Caption tone:  
  Educational, calm, confident, visually descriptive, and easy to understand.  
  It should feel like a verified science explanation, not a random fun fact.  
  Avoid hype, slang, and overly casual wording.
  Caption length:  
  Medium to long form, usually 175 to 300 words.
  SEO requirements:  
  The caption should naturally include searchable phrases related to the topic, such as:  
  Botanical classification  
  Plant structure  
  Seeds vs fruits  
  Fruit definitions  
  Plant reproduction  
  Why [topic] is classified this way  
  How botanists define [topic]  
  Common names vs scientific definitions  
  Plant anatomy explained
  Caption format example:
  [Surprising fact statement.]
  That sounds wrong until you understand how plants are actually classified.
  This visual botanical classification study explains the difference between common names and botanical definitions. In botany, fruits and seeds are not defined by taste, size, tradition, or how we use them in the kitchen. They are defined by structure, development, and how the plant reproduces.
  [Explain the specific plant fact clearly.]
  Most confusion about plant facts comes from relying on common names instead of botanical structure.
  This is why:  
  – [Key fact 1]  
  – [Key fact 2]  
  – [Key fact 3]  
  – [Key fact 4]
  Botanical classification doesn’t care about flavor, sweetness, or grocery store categories. It focuses on anatomy, reproductive structure, and development.
  This post is part of an ongoing botanical verification series designed to visually explain plant science concepts that often sound fake but are scientifically accurate.
  My brother studies plants.  
  I verify the facts.
  More verified botanical explanations coming soon.
  Topics covered:  
  [SEO keyword]  
  [SEO keyword]  
  [SEO keyword]  
  [SEO keyword]  
  [SEO keyword]  
  [SEO keyword]
  #[hashtag]  
  #[hashtag]  
  #[hashtag]  
  #[hashtag]  
  #[hashtag]
  Important:  
  Do not generate a short generic caption.  
  Do not only write a witty caption.  
  Do not make it sound like an ad.  
  Do not overuse hashtags.  
  Do not use incorrect science claims.  
  Always make the caption educational, searchable, and structured like a mini explanation.
- &nbsp;