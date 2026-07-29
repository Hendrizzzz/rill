export interface PracticeQuote {
  id: string;
  text: string;
  attribution: string;
  sourceUrl: string;
}

export const PRACTICE_QUOTES_V1: readonly PracticeQuote[] = [
  {
    id: "austen-emma-01",
    text: "There is no charm equal to tenderness of heart.",
    attribution: "Jane Austen · Emma",
    sourceUrl: "https://www.gutenberg.org/ebooks/158",
  },
  {
    id: "melville-moby-dick-01",
    text: "It is not down in any map; true places never are.",
    attribution: "Herman Melville · Moby-Dick",
    sourceUrl: "https://www.gutenberg.org/ebooks/2701",
  },
  {
    id: "douglass-life-times-01",
    text: "If he learns to read the Bible it will forever unfit him to be a slave.",
    attribution: "Frederick Douglass · Life and Times",
    sourceUrl: "https://www.gutenberg.org/ebooks/71893",
  },
  {
    id: "alcott-little-women-01",
    text: "\"Christmas won't be Christmas without any presents,\" grumbled Jo, lying on the rug.",
    attribution: "Louisa May Alcott · Little Women",
    sourceUrl: "https://www.gutenberg.org/ebooks/514",
  },
  {
    id: "thoreau-walden-01",
    text: "The mass of men lead lives of quiet desperation.",
    attribution: "Henry David Thoreau · Walden",
    sourceUrl: "https://www.gutenberg.org/ebooks/205",
  },
  {
    id: "wilde-dorian-gray-01",
    text: "Nowadays people know the price of everything and the value of nothing.",
    attribution: "Oscar Wilde · The Picture of Dorian Gray",
    sourceUrl: "https://www.gutenberg.org/ebooks/174",
  },
] as const;
