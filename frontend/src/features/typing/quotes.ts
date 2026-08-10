import { LITERARY_QUOTES_V3 } from "./literaryQuotes";

export interface PracticeQuote {
  id: string;
  text: string;
  attribution: string;
  sourceUrl: string;
  theme: string;
  rights: "public-domain" | "rill-original";
}

export const PRACTICE_QUOTES_V1: readonly PracticeQuote[] = [
  {
    id: "austen-emma-01",
    text: "There is no charm equal to tenderness of heart.",
    attribution: "Jane Austen · Emma",
    sourceUrl: "https://www.gutenberg.org/ebooks/158",
    theme: "kindness",
    rights: "public-domain",
  },
  {
    id: "melville-moby-dick-01",
    text: "It is not down in any map; true places never are.",
    attribution: "Herman Melville · Moby-Dick",
    sourceUrl: "https://www.gutenberg.org/ebooks/2701",
    theme: "wonder",
    rights: "public-domain",
  },
  {
    id: "douglass-life-times-01",
    text: "If he learns to read the Bible it will forever unfit him to be a slave.",
    attribution: "Frederick Douglass · Life and Times",
    sourceUrl: "https://www.gutenberg.org/ebooks/71893",
    theme: "learning",
    rights: "public-domain",
  },
  {
    id: "alcott-little-women-01",
    text: "\"Christmas won't be Christmas without any presents,\" grumbled Jo, lying on the rug.",
    attribution: "Louisa May Alcott · Little Women",
    sourceUrl: "https://www.gutenberg.org/ebooks/514",
    theme: "family",
    rights: "public-domain",
  },
  {
    id: "thoreau-walden-01",
    text: "The mass of men lead lives of quiet desperation.",
    attribution: "Henry David Thoreau · Walden",
    sourceUrl: "https://www.gutenberg.org/ebooks/205",
    theme: "perspective",
    rights: "public-domain",
  },
  {
    id: "wilde-dorian-gray-01",
    text: "Nowadays people know the price of everything and the value of nothing.",
    attribution: "Oscar Wilde · The Picture of Dorian Gray",
    sourceUrl: "https://www.gutenberg.org/ebooks/174",
    theme: "wit",
    rights: "public-domain",
  },
] as const;

const ORIGINAL_SOURCE_URL =
  "https://github.com/Hendrizzzz/typewriting/blob/main/docs/CONTENT_CORPUS.md";

const ORIGINAL_QUOTES_V2 = [
  {
    id: "craft-01",
    theme: "craft",
    text: "The cleanest solution is often the one you can explain before the coffee cools.",
  },
  {
    id: "craft-02",
    theme: "craft",
    text: "A careful name can save the next reader an hour.",
  },
  {
    id: "craft-03",
    theme: "craft",
    text: "Good work leaves the bench tidier than it found it.",
  },
  {
    id: "craft-04",
    theme: "craft",
    text: "Speed matters most after direction is clear.",
  },
  {
    id: "craft-05",
    theme: "craft",
    text: "A small finished thing teaches more than a grand unfinished plan.",
  },
  {
    id: "craft-06",
    theme: "craft",
    text: "Precision is kindness offered to whoever comes next.",
  },
  {
    id: "craft-07",
    theme: "craft",
    text: "The last ten percent is where a draft becomes a promise.",
  },
  {
    id: "craft-08",
    theme: "craft",
    text: "Tools improve when curiosity outlives frustration.",
  },
  {
    id: "learning-01",
    theme: "learning",
    text: "Confusion is not failure; it is the map before the landmarks appear.",
  },
  {
    id: "learning-02",
    theme: "learning",
    text: "The question you nearly kept quiet may unlock the whole room.",
  },
  {
    id: "learning-03",
    theme: "learning",
    text: "Practice turns a difficult motion into a familiar path.",
  },
  {
    id: "learning-04",
    theme: "learning",
    text: "Read until the idea feels strange, then build until it feels obvious.",
  },
  {
    id: "learning-05",
    theme: "learning",
    text: "A mistake remembered clearly becomes a shortcut tomorrow.",
  },
  {
    id: "learning-06",
    theme: "learning",
    text: "Understanding arrives quietly after enough honest attempts.",
  },
  {
    id: "learning-07",
    theme: "learning",
    text: "The best notes leave room for a better explanation later.",
  },
  {
    id: "learning-08",
    theme: "learning",
    text: "Teach the idea once, and you will discover which part you never understood.",
  },
  {
    id: "courage-01",
    theme: "courage",
    text: "Courage can be quiet enough to sound like one more try.",
  },
  {
    id: "courage-02",
    theme: "courage",
    text: "Begin before confidence arrives; it often travels a few steps behind.",
  },
  {
    id: "courage-03",
    theme: "courage",
    text: "You do not need the whole road to choose the next honest turn.",
  },
  {
    id: "courage-04",
    theme: "courage",
    text: "Some doors open only after you stop rehearsing the knock.",
  },
  {
    id: "courage-05",
    theme: "courage",
    text: "Bravery is often a trembling hand that still reaches forward.",
  },
  {
    id: "courage-06",
    theme: "courage",
    text: "The first attempt owes nobody a perfect ending.",
  },
  {
    id: "courage-07",
    theme: "courage",
    text: "A hard conversation becomes lighter the moment truth enters it.",
  },
  {
    id: "courage-08",
    theme: "courage",
    text: "Choose the step that lets tomorrow respect today.",
  },
  {
    id: "friendship-01",
    theme: "friendship",
    text: "A good friend remembers your story without trapping you inside it.",
  },
  {
    id: "friendship-02",
    theme: "friendship",
    text: "The longest evenings become short beside the right people.",
  },
  {
    id: "friendship-03",
    theme: "friendship",
    text: "Listen closely enough and ordinary words begin carrying whole lives.",
  },
  {
    id: "friendship-04",
    theme: "friendship",
    text: "Kindness is how strangers discover they were never very far apart.",
  },
  {
    id: "friendship-05",
    theme: "friendship",
    text: "Shared laughter is a small country with room for everyone.",
  },
  {
    id: "friendship-06",
    theme: "friendship",
    text: "Show up on the unremarkable days; they are most of a friendship.",
  },
  {
    id: "friendship-07",
    theme: "friendship",
    text: "The right company makes silence feel complete instead of empty.",
  },
  {
    id: "friendship-08",
    theme: "friendship",
    text: "A sincere check-in can travel farther than polished advice.",
  },
  {
    id: "focus-01",
    theme: "focus",
    text: "Attention is a door; close it gently on everything outside the room.",
  },
  {
    id: "focus-02",
    theme: "focus",
    text: "One clear hour can rescue a week of scattered minutes.",
  },
  {
    id: "focus-03",
    theme: "focus",
    text: "Finish the sentence in front of you before arguing with the next page.",
  },
  {
    id: "focus-04",
    theme: "focus",
    text: "A shorter list gives each promise more weight.",
  },
  {
    id: "focus-05",
    theme: "focus",
    text: "The work gets quieter when the reason for doing it gets louder.",
  },
  {
    id: "focus-06",
    theme: "focus",
    text: "Put the phone beyond reach and the afternoon returns to you.",
  },
  {
    id: "focus-07",
    theme: "focus",
    text: "Protect the first useful thought from the next ten interesting ones.",
  },
  {
    id: "focus-08",
    theme: "focus",
    text: "A calm pace can still cover astonishing ground.",
  },
  {
    id: "rest-01",
    theme: "rest",
    text: "Rest is not a reward for being human; it is part of the work.",
  },
  {
    id: "rest-02",
    theme: "rest",
    text: "A tired mind turns every hill into a mountain range.",
  },
  {
    id: "rest-03",
    theme: "rest",
    text: "Leave something unfinished tonight so tomorrow has a place to begin.",
  },
  {
    id: "rest-04",
    theme: "rest",
    text: "The pause between efforts is where strength quietly returns.",
  },
  {
    id: "rest-05",
    theme: "rest",
    text: "Not every empty hour needs to become an achievement.",
  },
  {
    id: "rest-06",
    theme: "rest",
    text: "Sleep edits problems that determination only underlines.",
  },
  {
    id: "rest-07",
    theme: "rest",
    text: "A slow morning can keep the whole day from rushing past.",
  },
  {
    id: "rest-08",
    theme: "rest",
    text: "Stop while you still remember why you wanted to continue.",
  },
  {
    id: "change-01",
    theme: "change",
    text: "A new direction begins as a small disagreement with yesterday.",
  },
  {
    id: "change-02",
    theme: "change",
    text: "Growth rarely announces itself while it is rearranging the room.",
  },
  {
    id: "change-03",
    theme: "change",
    text: "The old plan can be honored without being obeyed forever.",
  },
  {
    id: "change-04",
    theme: "change",
    text: "You may outgrow a dream without betraying the person who dreamed it.",
  },
  {
    id: "change-05",
    theme: "change",
    text: "Some progress looks like carrying less into the next season.",
  },
  {
    id: "change-06",
    theme: "change",
    text: "The route can change while the destination remains true.",
  },
  {
    id: "change-07",
    theme: "change",
    text: "Small habits vote every day for the person you are becoming.",
  },
  {
    id: "change-08",
    theme: "change",
    text: "Make room for the version of you that no longer needs permission.",
  },
  {
    id: "wonder-01",
    theme: "wonder",
    text: "The night sky is old light arriving exactly when you look up.",
  },
  {
    id: "wonder-02",
    theme: "wonder",
    text: "A familiar street becomes new when rain writes on every window.",
  },
  {
    id: "wonder-03",
    theme: "wonder",
    text: "Curiosity is the habit of leaving one chair empty for surprise.",
  },
  {
    id: "wonder-04",
    theme: "wonder",
    text: "The ocean keeps no straight lines, yet always finds the shore.",
  },
  {
    id: "wonder-05",
    theme: "wonder",
    text: "Look closely: even ordinary dust knows how to dance in sunlight.",
  },
  {
    id: "wonder-06",
    theme: "wonder",
    text: "Every library is a city where the lights wait inside closed books.",
  },
  {
    id: "wonder-07",
    theme: "wonder",
    text: "A train window can turn an hour into a moving gallery.",
  },
  {
    id: "wonder-08",
    theme: "wonder",
    text: "The world becomes larger whenever certainty makes space for a question.",
  },
  {
    id: "home-01",
    theme: "home",
    text: "Home is partly a place and partly the way someone says your name.",
  },
  {
    id: "home-02",
    theme: "home",
    text: "A warm kitchen can hold more history than a shelf of photographs.",
  },
  {
    id: "home-03",
    theme: "home",
    text: "The smallest rituals are often the beams that hold a life together.",
  },
  {
    id: "home-04",
    theme: "home",
    text: "Some rooms remember us by the quiet we leave behind.",
  },
  {
    id: "home-05",
    theme: "home",
    text: "A borrowed cup becomes a welcome when it returns filled.",
  },
  {
    id: "home-06",
    theme: "home",
    text: "Belonging begins where explanation is no longer required.",
  },
  {
    id: "home-07",
    theme: "home",
    text: "The road home measures distance differently after a difficult day.",
  },
  {
    id: "home-08",
    theme: "home",
    text: "Keep one corner of your life arranged for unexpected company.",
  },
  {
    id: "resilience-01",
    theme: "resilience",
    text: "A bent branch still knows the direction of the sun.",
  },
  {
    id: "resilience-02",
    theme: "resilience",
    text: "Recovery is progress wearing quieter clothes.",
  },
  {
    id: "resilience-03",
    theme: "resilience",
    text: "Begin again with the knowledge the first beginning had to earn.",
  },
  {
    id: "resilience-04",
    theme: "resilience",
    text: "The crack is not the whole story of the cup.",
  },
  {
    id: "resilience-05",
    theme: "resilience",
    text: "Hard seasons teach roots to work where nobody applauds.",
  },
  {
    id: "resilience-06",
    theme: "resilience",
    text: "You can move slowly and still refuse to move backward.",
  },
  {
    id: "resilience-07",
    theme: "resilience",
    text: "The day after disappointment is still available for building.",
  },
  {
    id: "resilience-08",
    theme: "resilience",
    text: "Strength sometimes looks like asking another pair of hands to help.",
  },
  {
    id: "humor-01",
    theme: "humor",
    text: "The bug became shy the moment someone else looked at the screen.",
  },
  {
    id: "humor-02",
    theme: "humor",
    text: "Coffee cannot solve recursion, but it can wait beside you politely.",
  },
  {
    id: "humor-03",
    theme: "humor",
    text: "Every five-minute task has a secret plan for the afternoon.",
  },
  {
    id: "humor-04",
    theme: "humor",
    text: "The missing key was exactly where yesterday's confidence left it.",
  },
  {
    id: "humor-05",
    theme: "humor",
    text: "A meeting without an agenda is a group project for clocks.",
  },
  {
    id: "humor-06",
    theme: "humor",
    text: "The password was unforgettable until the login screen asked for it.",
  },
  {
    id: "humor-07",
    theme: "humor",
    text: "Nothing organizes a desk faster than needing one tiny receipt.",
  },
  {
    id: "humor-08",
    theme: "humor",
    text: "The printer can sense urgency and considers it a creative challenge.",
  },
  {
    id: "perspective-01",
    theme: "perspective",
    text: "A problem viewed from tomorrow is often smaller and more specific.",
  },
  {
    id: "perspective-02",
    theme: "perspective",
    text: "Not every closed door is a verdict; sometimes the room is simply full.",
  },
  {
    id: "perspective-03",
    theme: "perspective",
    text: "The hill behind you explains the view in front of you.",
  },
  {
    id: "perspective-04",
    theme: "perspective",
    text: "Urgent and important are neighbors, not twins.",
  },
  {
    id: "perspective-05",
    theme: "perspective",
    text: "A different answer may be evidence of a different question.",
  },
  {
    id: "perspective-06",
    theme: "perspective",
    text: "The map becomes useful when you admit where you are.",
  },
  {
    id: "perspective-07",
    theme: "perspective",
    text: "Most overnight success has a drawer full of quiet mornings.",
  },
  {
    id: "perspective-08",
    theme: "perspective",
    text: "What feels like waiting may be the season when judgment catches up.",
  },
  {
    id: "beginnings-01",
    theme: "beginnings",
    text: "Start with the part you can touch, test, or tell to a friend.",
  },
  {
    id: "beginnings-02",
    theme: "beginnings",
    text: "A blank page is not empty; it is listening.",
  },
  {
    id: "beginnings-03",
    theme: "beginnings",
    text: "The first useful version is allowed to look like a beginning.",
  },
  {
    id: "beginnings-04",
    theme: "beginnings",
    text: "Open the notebook before waiting for the perfect thought.",
  },
  {
    id: "beginnings-05",
    theme: "beginnings",
    text: "Momentum often enters through a task too small to fear.",
  },
  {
    id: "beginnings-06",
    theme: "beginnings",
    text: "A rough outline gives uncertainty somewhere useful to stand.",
  },
  {
    id: "beginnings-07",
    theme: "beginnings",
    text: "New habits prefer ordinary Tuesdays to dramatic declarations.",
  },
  {
    id: "beginnings-08",
    theme: "beginnings",
    text: "Make the doorway easy and the journey has a chance.",
  },
  {
    id: "scene-01",
    theme: "craft",
    text: "At two in the morning, the failing test finally confessed: one quiet assumption had been doing all the damage.",
  },
  {
    id: "scene-02",
    theme: "friendship",
    text: "\"Take the umbrella,\" Mara said, pretending the forecast mattered more than having a reason to meet again tomorrow.",
  },
  {
    id: "scene-03",
    theme: "perspective",
    text: "Three bus stops beyond his usual route, Nico discovered that being lost and being curious can look exactly alike.",
  },
  {
    id: "scene-04",
    theme: "home",
    text: "When the power returned, nobody moved to switch off the candles; the room had remembered a better way to listen.",
  },
  {
    id: "scene-05",
    theme: "wonder",
    text: "Someone left a paper boat in the fountain, and by noon every child in the square had given it a destination.",
  },
  {
    id: "scene-06",
    theme: "learning",
    text: "On the whiteboard, the crossed-out attempts explained the solution more honestly than the polished answer beneath them.",
  },
  {
    id: "scene-07",
    theme: "resilience",
    text: "By closing time, the baker had ruined two loaves, saved the third, and learned which mistake the recipe forgot to mention.",
  },
  {
    id: "scene-08",
    theme: "humor",
    text: "We named the office plant Deadline because it leaned dramatically whenever somebody said there was plenty of time.",
  },
  {
    id: "scene-09",
    theme: "courage",
    text: "Under the stadium lights, her hands still shook; courage did not remove the fear—it simply took the first serve.",
  },
  {
    id: "scene-10",
    theme: "focus",
    text: "Before the launch, he closed every dashboard except the one that could answer the next useful question.",
  },
  {
    id: "scene-11",
    theme: "craft",
    text: "No one remembers the clever shortcut after it breaks, but everyone remembers the simple repair they could understand.",
  },
  {
    id: "scene-12",
    theme: "rest",
    text: "Rain tapped the window for an hour while the unfinished notebook waited without complaint on the other side of sleep.",
  },
  {
    id: "scene-13",
    theme: "home",
    text: "My grandfather measured recipes with his palm, stories with long pauses, and welcome by adding another chair.",
  },
  {
    id: "scene-14",
    theme: "beginnings",
    text: "At the last page of the old notebook, she found enough blank space to begin the next idea.",
  },
  {
    id: "scene-15",
    theme: "change",
    text: "Between the cancelled train and the unfamiliar street, the day abandoned its plan and became worth remembering.",
  },
  {
    id: "scene-16",
    theme: "friendship",
    text: "When the train doors closed, they kept waving until the platform vanished, as if distance might be persuaded by effort.",
  },
  {
    id: "scene-17",
    theme: "learning",
    text: "One clear function can teach data flow, naming, boundaries, and restraint before a lecture finishes defining any of them.",
  },
  {
    id: "scene-18",
    theme: "resilience",
    text: "She kept the cracked mug on her desk because repaired things deserve ordinary mornings, not permanent display cases.",
  },
  {
    id: "scene-19",
    theme: "humor",
    text: "Five minutes into the video call, everyone agreed the missing microphone had contributed the clearest opinion.",
  },
  {
    id: "scene-20",
    theme: "wonder",
    text: "In the quiet museum, a child copied the statue's pose and made two thousand years briefly feel playful.",
  },
] as const;

export const PRACTICE_QUOTES_V2: readonly PracticeQuote[] = [
  ...PRACTICE_QUOTES_V1,
  ...ORIGINAL_QUOTES_V2.map((quote) => ({
    ...quote,
    attribution: "Rill original",
    sourceUrl: ORIGINAL_SOURCE_URL,
    rights: "rill-original" as const,
  })),
];

export const PRACTICE_QUOTES_V3: readonly PracticeQuote[] = [
  ...PRACTICE_QUOTES_V2,
  ...LITERARY_QUOTES_V3,
];

export const PRACTICE_QUOTE_COUNT = PRACTICE_QUOTES_V3.length;
