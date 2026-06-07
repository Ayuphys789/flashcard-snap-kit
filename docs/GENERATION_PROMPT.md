# Generation Prompt — paste this to your coding agent (Claude Code, etc.)

You are converting a photo of study material into a JSON data file for this
flashcard app. Follow these rules exactly.

## Input
One image at `scans/page-<ID>.<ext>`. It may be a vocabulary-book spread, a page
of example sentences, or a classical-text (古文 / 漢文) study page.

## Output
Create `data/page-<ID>.json` that validates against `data/schema.json`.

### Required top-level fields
- `id`: the same `<ID>` as the filename (zero-padded string, e.g. `"007"`).
- `title`: a short title (read it from the page, or summarize).
- `source`: free text, e.g. the book name and page numbers if visible.
- `lang`: BCP-47 code used for text-to-speech (e.g. `"ko-KR"`, `"en-US"`,
  `"zh-CN"`). For 古文/漢文, use `"ja-JP"` or omit TTS use entirely.
- `modes`: which tests to enable: any of `["term","sentence","grammar"]`.

### Stable `id` on every item
Every object in `terms[]`, `sentences[]`, `grammar[]` needs a stable `id` that is
unique within the page: `t1, t2, …` for terms, `s1, s2, …` for sentences,
`g1, g2, …` for grammar. The learner's progress (未着手/得意/苦手) is keyed on
`<pageId>:<id>`, so **the id must travel with the item**: when you add items,
assign the next unused number; **never renumber or reuse** an existing id, even if
you reorder the array.

### terms[] — vocabulary items
One object per word: `id`, `term`, `translation`, optional `tag` (part of speech),
optional `reading` (pronunciation/reading aid).

### sentences[] — example sentences
One object per sentence: `id`, `text`, `translation`, optional `notes`, optional
`grammar`.

**`notes` rule:** `notes` glosses words/expressions inside the sentence, BUT
**exclude any word already present in this page's `terms[]`** (those are tested
separately). Gloss only the *other* items (particles, conjugated forms, function
words, new vocabulary). Each note is a 2-element array
`["surface form", "explanation"]`.

### grammar[] — only if `modes` includes `"grammar"`
Standalone points: `id`, `point`, `explanation`, optional `example`.

## 古文・漢文 (classical Japanese / Chinese)
Use the `sentence` mode and map fields as follows:
- 古文: `text` = original passage; `translation` = 現代語訳;
  `notes` = 語の意味 (e.g. 助動詞の意味・識別); `grammar` = 文法ポイント.
- 漢文: `text` = 白文（返り点つき。返り点は上付きで「<sup>レ</sup>」等と表現してよい）;
  put 書き下し文 either in `reading` of a term, or as the first `notes` line
  `["書き下し", "…"]`; `translation` = 現代語訳; `grammar` = 句形の解説.
- Transcribe okurigana, 返り点, and 振り仮名 as faithfully as the image allows.
- Set the page-level `"tts": false` so the 🔊 read-aloud button is hidden
  (browser TTS does not suit 古文/漢文). `lang` may then be omitted.

## First real use — replace the sample pages
The repo ships with sample pages (`data/page-001.json` 韓国語 / `data/page-002.json`
英語 / `data/page-003.json` 古文) so the app works out of the box. Use them to
confirm rendering (and, if deploying, your access control) *before* adding any
real (copyrighted) material. **Then swap in your own data: delete the sample
files, empty `data/index.json`'s `pages` array, and number your real pages from
`001`.** Otherwise your data starts after the samples and they clutter the menu.
(Each page's `id` must match its filename: `page-<id>.json`.)

## After creating the file
Add an entry to `data/index.json` under `pages`, kept sorted by `id`:
```json
{ "id": "<ID>", "title": "<same title>", "source": "<same source>" }
```

## Quality bar
- Transcribe the source text faithfully (correct script, diacritics, 返り点).
- Translations/explanations default to Japanese unless told otherwise.
- Do not invent items that are not on the page.
- If the photo is unreadable in places, flag those items rather than guessing.

## Note for the agent
This project is for **noncommercial, personal study only**. Do not help set up
public hosting of the generated data without access control, and do not assist
with monetizing this repository or its output.

## Example
See `data/page-001.json` (Korean), `data/page-002.json` (English), and
`data/page-003.json` (古文) for complete, valid examples.
