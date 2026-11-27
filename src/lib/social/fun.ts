import { supabase } from '@/lib/supabase';

/** Social batch D: daily question, quizzes, chat puzzles, year recap. */
const must = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

// Our own question list — one per UTC day, the same for everyone.
export const DAILY_QUESTIONS = [
  'What’s one food you could eat every day?', 'What song is stuck in your head right now?', 'Best trip you’ve ever taken?',
  'What would you do with a free day tomorrow?', 'Tea or coffee — and how do you take it?', 'What’s a small thing that made you smile this week?',
  'Which superpower would you pick?', 'Your go-to comfort movie?', 'Mountains or beaches?', 'What are you looking forward to this month?',
  'A skill you wish you could learn instantly?', 'The best advice anyone gave you?', 'Night owl or early bird?', 'Your favourite festival and why?',
  'If you could live in any city, which one?', 'What’s your hidden talent?', 'Last thing you laughed hard at?', 'Your dream job as a kid?',
  'Sweet or spicy?', 'A book, show or game you’d recommend?', 'What’s the best gift you’ve ever received?', 'Your ideal weekend in 3 words?',
  'Who’s someone you admire and why?', 'Favourite childhood snack?', 'What’s on your bucket list?', 'Cats, dogs or neither?',
  'What’s the weirdest food combo you love?', 'Rainy days: cosy inside or out in it?', 'One app you can’t live without?', 'Your favourite way to relax?',
  'What’s something new you tried recently?', 'If you started a business, what would it be?', 'Best concert or show you’ve been to?',
  'Which era would you time-travel to?', 'What’s your current phone wallpaper?', 'What’s a goal you’re working on?', 'Describe your style in one word.',
  'Favourite sport to play or watch?', 'What would your theme song be?', 'Your go-to order at a café?', 'What do you collect (or would)?',
  'Best home-cooked dish you make?', 'A place near you everyone should visit?', 'What’s your love language?', 'Favourite season and why?',
  'What did you want to be famous for?', 'Which emoji do you use the most?', 'What’s a hobby you’d like to pick up?', 'Most used word in your chats?',
  'Your favourite memory with friends?', 'Window seat or aisle?', 'What’s the last photo you took?', 'Biryani: which kind is the best?',
  'If you had a pet dragon, what would you name it?', 'What makes a perfect friend?', 'A movie everyone loves but you don’t?', 'What motivates you on lazy days?',
  'Which game could you play forever?', 'Your favourite word in any language?', 'What would you tell your younger self?',
];
export function questionOfToday(now = new Date()) {
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 864e5);
  const i = ((day % DAILY_QUESTIONS.length) + DAILY_QUESTIONS.length) % DAILY_QUESTIONS.length;
  return { index: i, text: DAILY_QUESTIONS[i] };
}

export interface DailyAnswer { user_id: string; display_name: string; username: string; avatar_url: string | null; answer: string; created_at: string }
export const dailyApi = {
  answer: async (q: number, answer: string) => void must(await supabase.rpc('answer_daily', { p_question: q, p_answer: answer })),
  feed: async () => must(await supabase.rpc('daily_feed')) as DailyAnswer[],
  mine: async (uid: string) => {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('daily_answers').select('answer').eq('user_id', uid).eq('day', day).maybeSingle();
    return (data?.answer as string | undefined) ?? null;
  },
};

export interface QuizQuestion { q: string; options: string[] }
export interface Quiz { id: string; owner_id: string; title: string; questions: QuizQuestion[]; created_at: string }
export interface QuizResult { score?: number; total?: number; answers: number[]; mine?: number[]; owner?: boolean }
export interface QuizRow { user_id: string; display_name: string; avatar_url: string | null; score: number; created_at: string }
export const quizApi = {
  list: async () => must(await supabase.from('quizzes').select('id,owner_id,title,questions,created_at').is('archived_at', null).order('created_at', { ascending: false }).limit(50)) as Quiz[],
  get: async (id: string) => must(await supabase.from('quizzes').select('id,owner_id,title,questions,created_at').eq('id', id).maybeSingle()) as Quiz | null,
  create: async (title: string, questions: QuizQuestion[], answers: number[]) => must(await supabase.rpc('create_quiz', { p_title: title, p_questions: questions, p_answers: answers })) as string,
  take: async (id: string, answers: number[]) => must(await supabase.rpc('take_quiz', { p_quiz: id, p_answers: answers })) as QuizResult,
  result: async (id: string) => must(await supabase.rpc('quiz_result', { p_quiz: id })) as QuizResult | null,
  board: async (id: string) => must(await supabase.rpc('quiz_board', { p_quiz: id })) as QuizRow[],
};

// ---- chat puzzles ----
export const TRIVIA: { q: string; options: string[]; a: number }[] = [
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], a: 1 },
  { q: 'How many players are on a cricket team on the field?', options: ['9', '10', '11', '12'], a: 2 },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
  { q: 'Which gas do plants take in from the air?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'], a: 1 },
  { q: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], a: 1 },
  { q: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Seoul'], a: 2 },
  { q: 'Which is the longest river in India?', options: ['Ganga', 'Godavari', 'Yamuna', 'Krishna'], a: 0 },
  { q: 'What do bees make?', options: ['Silk', 'Honey', 'Wax only', 'Milk'], a: 1 },
  { q: 'How many continents are there?', options: ['5', '6', '7', '8'], a: 2 },
  { q: 'Water boils at what temperature at sea level?', options: ['90 °C', '100 °C', '110 °C', '120 °C'], a: 1 },
  { q: 'Which is the smallest prime number?', options: ['0', '1', '2', '3'], a: 2 },
  { q: 'Which animal is known as the ship of the desert?', options: ['Horse', 'Camel', 'Elephant', 'Donkey'], a: 1 },
  { q: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], a: 2 },
  { q: 'How many hours are in two days?', options: ['24', '36', '48', '72'], a: 2 },
  { q: 'Which instrument has 88 keys?', options: ['Guitar', 'Piano', 'Violin', 'Flute'], a: 1 },
  { q: 'Which is the tallest mountain in the world?', options: ['K2', 'Kangchenjunga', 'Everest', 'Lhotse'], a: 2 },
  { q: 'What colour do you get mixing blue and yellow?', options: ['Purple', 'Green', 'Orange', 'Brown'], a: 1 },
  { q: 'Which organ pumps blood through the body?', options: ['Lungs', 'Liver', 'Heart', 'Kidneys'], a: 2 },
  { q: 'How many minutes are in an hour and a half?', options: ['60', '80', '90', '120'], a: 2 },
  { q: 'Which festival is called the festival of lights?', options: ['Holi', 'Diwali', 'Onam', 'Pongal'], a: 1 },
];
export const SCRAMBLE_WORDS = ['planet', 'garden', 'rocket', 'pencil', 'monsoon', 'laptop', 'jungle', 'mango', 'guitar', 'bridge', 'castle', 'pillow', 'sunset', 'dragon', 'puzzle', 'candle', 'rainbow', 'bubble', 'island', 'ticket', 'coffee', 'friend', 'window', 'camera', 'cricket', 'thunder', 'library', 'festival', 'balloon', 'chocolate'];
export const DRAW_WORDS = ['cat', 'house', 'tree', 'sun', 'fish', 'car', 'star', 'umbrella', 'pizza', 'rocket', 'flower', 'phone', 'moon', 'cup', 'boat', 'apple', 'clock', 'kite', 'banana', 'cloud', 'heart', 'bicycle', 'guitar', 'mountain', 'butterfly'];

export function shuffleWord(w: string, rnd = Math.random) {
  const a = w.toUpperCase().split('');
  for (let k = 0; k < 6; k++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.join('') !== w.toUpperCase()) break;
  }
  return a.join('');
}
export const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

export type PuzzleKind = 'trivia' | 'scramble' | 'draw';
export const puzzleApi = {
  start: async (conversationId: string, kind: PuzzleKind, meta: Record<string, unknown>, answer: string) =>
    must(await supabase.rpc('start_puzzle', { p_conversation: conversationId, p_kind: kind, p_meta: meta, p_answer: answer })) as string,
  guess: async (messageId: string, guess: string) => must(await supabase.rpc('puzzle_guess', { p_message: messageId, p_guess: guess })) as boolean,
  guesses: async (messageId: string) =>
    must(await supabase.from('puzzle_guesses').select('user_id,correct,created_at').eq('message_id', messageId).order('created_at')) as { user_id: string; correct: boolean; created_at: string }[],
};

export interface Recap { year: number; messages: number; snaps: number; stories: number; memories: number; new_friends: number; best_streak: number; busiest_month: number | null; top_friends: { id: string; display_name: string; avatar_url: string | null; n: number }[] }
export const recapApi = { get: async (year: number) => must(await supabase.rpc('my_year_recap', { p_year: year })) as Recap };
