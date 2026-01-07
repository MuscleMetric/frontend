// lib/quotes.ts
export type Quote = {
  text: string;
  author: string;
};

export const QUOTES: Quote[] = [
  {
    text: "It is never too late to be what you might have been.",
    author: "George Eliot",
  },
  { text: "To live is the rarest thing in the world.", author: "Oscar Wilde" },
  {
    text: "Pain is inevitable. Suffering is optional.",
    author: "Haruki Murakami",
  },
  {
    text: "Whatever the mind of man can conceive and believe, it can achieve.",
    author: "Napoleon Hill",
  },
  {
    text: "Go confidently in the direction of your dreams. Live the life you have imagined.",
    author: "Henry David Thoreau",
  },
  {
    text: "Shoot for the moon. Even if you miss, you'll land among the stars.",
    author: "Les Brown",
  },
  {
    text: "If you obey all the rules, you miss all the fun.",
    author: "Katharine Hepburn",
  },
  {
    text: "Don’t say you don’t have enough time. You have exactly the same number of hours per day as everyone else.",
    author: "H. Jackson Brown Jr.",
  },
  {
    text: "Be yourself; everyone else is already taken.",
    author: "Oscar Wilde",
  },
  {
    text: "The future starts today, not tomorrow.",
    author: "Pope John Paul II",
  },
  {
    text: "You don’t have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
  },
  {
    text: "If you want to build a ship, don’t drum up people to gather wood. Teach them to yearn for the sea.",
    author: "Antoine de Saint-Exupéry",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "All that we are is the result of what we have thought.",
    author: "Buddha",
  },
  {
    text: "Everything is theoretically impossible, until it is done.",
    author: "Robert A. Heinlein",
  },
  {
    text: "Be the change that you wish to see in the world.",
    author: "Mahatma Gandhi",
  },
  {
    text: "Success usually comes to those who are too busy to be looking for it.",
    author: "Henry David Thoreau",
  },
  {
    text: "Don’t watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    text: "What you get by achieving your goals is not as important as what you become by achieving your goals.",
    author: "Zig Ziglar",
  },
  {
    text: "Believe you can and you’re halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
  },
  {
    text: "Our greatest glory is not in never falling, but in rising every time we fall.",
    author: "Confucius",
  },
  {
    text: "You miss 100% of the shots you don’t take.",
    author: "Wayne Gretzky",
  },
  {
    text: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
  },
  {
    text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "Success is walking from failure to failure with no loss of enthusiasm.",
    author: "Winston Churchill",
  },
  {
    text: "Do the best you can until you know better. Then when you know better, do better.",
    author: "Maya Angelou",
  },
  {
    text: "There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.",
    author: "Ernest Hemingway",
  },
  { text: "Stay afraid, but do it anyway.", author: "Carrie Fisher" },
  {
    text: "If there is no struggle, there is no progress.",
    author: "Frederick Douglass",
  },
  {
    text: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    author: "Thomas Edison",
  },
];

// Deterministic “quote of the day” using a seed (e.g., userId + YYYY-MM-DD)
export function quoteOfTheDay(seed: string): Quote {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % QUOTES.length;
  return QUOTES[idx];
}
