/**
 * The daily quotes. Every quote is in the public domain: English-language authors who
 * died long ago (in their own published words), classical authors in 19th-century
 * translations (named in `source`), or traditional proverbs. Attributions were chosen
 * carefully; popular quotes that are commonly misattributed are deliberately left out.
 *
 * IDs are permanent: they're stored in settings (today's quote, recently shown), so never
 * change or reuse one. Line breaks in poetry are "\n".
 */

export type QuoteCategory = 'motivation' | 'learning' | 'calm' | 'kindness' | 'joy';

export const QUOTE_CATEGORIES: { id: QuoteCategory; label: string }[] = [
  { id: 'motivation', label: 'Keep going' },
  { id: 'learning', label: 'Learning' },
  { id: 'calm', label: 'Calm' },
  { id: 'kindness', label: 'Kindness' },
  { id: 'joy', label: 'Joy & wonder' },
];

export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  category: QuoteCategory;
}

const PRA = "Poor Richard's Almanack";
const LEGGE_ANALECTS = 'The Analects, tr. James Legge';
const LEGGE_TAO = 'Tao Te Ching, tr. James Legge';
const LONG_MEDITATIONS = 'Meditations, tr. George Long';
const GUMMERE = 'Letters to Lucilius, tr. Richard M. Gummere';

// prettier-ignore
export const QUOTES: Quote[] = [
  // ---------- Keep going ----------
  { id: 'm-well-begun', text: 'Well begun is half done.', author: 'Aristotle', source: 'Politics', category: 'motivation' },
  { id: 'm-lost-time', text: 'Lost time is never found again.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-well-done', text: 'Well done is better than well said.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-little-strokes', text: 'Little strokes fell great oaks.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-diligence', text: 'Diligence is the mother of good luck.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-do-it-today', text: 'Have you somewhat to do tomorrow, do it today.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-one-today', text: 'One today is worth two tomorrows.', author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-squander-time', text: "Dost thou love life? Then do not squander time, for that's the stuff life is made of.", author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-sundial', text: "Hide not your talents, they for use were made.\nWhat's a sundial in the shade?", author: 'Benjamin Franklin', source: PRA, category: 'motivation' },
  { id: 'm-rome', text: 'Rome was not built in a day.', author: 'Proverb', category: 'motivation' },
  { id: 'm-slow-steady', text: 'Slow but steady wins the race.', author: 'Aesop', source: 'The Hare and the Tortoise, tr. George Fyler Townsend', category: 'motivation' },
  { id: 'm-rising', text: 'Our greatest glory is not in never falling, but in rising every time we fall.', author: 'Oliver Goldsmith', category: 'motivation' },
  { id: 'm-enthusiasm', text: 'Nothing great was ever achieved without enthusiasm.', author: 'Ralph Waldo Emerson', source: 'Circles', category: 'motivation' },
  { id: 'm-dreams', text: 'If one advances confidently in the direction of his dreams, and endeavors to live the life which he has imagined, he will meet with a success unexpected in common hours.', author: 'Henry David Thoreau', source: 'Walden', category: 'motivation' },
  { id: 'm-doubts', text: 'Our doubts are traitors,\nAnd make us lose the good we oft might win\nBy fearing to attempt.', author: 'William Shakespeare', source: 'Measure for Measure', category: 'motivation' },
  { id: 'm-stars', text: 'The fault, dear Brutus, is not in our stars,\nBut in ourselves.', author: 'William Shakespeare', source: 'Julius Caesar', category: 'motivation' },
  { id: 'm-may-be', text: 'We know what we are, but know not what we may be.', author: 'William Shakespeare', source: 'Hamlet', category: 'motivation' },
  { id: 'm-fierce', text: 'Though she be but little, she is fierce.', author: 'William Shakespeare', source: "A Midsummer Night's Dream", category: 'motivation' },
  { id: 'm-storms', text: "I'm not afraid of storms, for I'm learning how to sail my ship.", author: 'Louisa May Alcott', source: 'Little Women', category: 'motivation' },
  { id: 'm-up-doing', text: 'Let us, then, be up and doing,\nWith a heart for any fate;\nStill achieving, still pursuing,\nLearn to labor and to wait.', author: 'Henry Wadsworth Longfellow', source: 'A Psalm of Life', category: 'motivation' },
  { id: 'm-strive', text: 'To strive, to seek, to find, and not to yield.', author: 'Alfred, Lord Tennyson', source: 'Ulysses', category: 'motivation' },
  { id: 'm-reach', text: "Ah, but a man's reach should exceed his grasp,\nOr what's a heaven for?", author: 'Robert Browning', source: 'Andrea del Sarto', category: 'motivation' },
  { id: 'm-courage', text: 'Courage is resistance to fear, mastery of fear—not absence of fear.', author: 'Mark Twain', source: "Pudd'nhead Wilson", category: 'motivation' },
  { id: 'm-struggle', text: 'If there is no struggle there is no progress.', author: 'Frederick Douglass', category: 'motivation' },
  { id: 'm-obstacles', text: 'Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome while trying to succeed.', author: 'Booker T. Washington', source: 'Up from Slavery', category: 'motivation' },
  { id: 'm-practice', text: 'Practice makes perfect.', author: 'Proverb', category: 'motivation' },
  { id: 'm-will-way', text: "Where there's a will, there's a way.", author: 'Proverb', category: 'motivation' },
  { id: 'm-try-again', text: "If at first you don't succeed, try, try again.", author: 'Proverb', category: 'motivation' },
  { id: 'm-be-such', text: 'No longer talk at all about the kind of man that a good man ought to be, but be such.', author: 'Marcus Aurelius', source: LONG_MEDITATIONS, category: 'motivation' },
  { id: 'm-journey', text: 'The journey of a thousand li commences with a single step.', author: 'Lao Tzu', source: LEGGE_TAO, category: 'motivation' },
  { id: 'm-postponing', text: 'While we are postponing, life speeds by.', author: 'Seneca', source: GUMMERE, category: 'motivation' },
  { id: 'm-amateur', text: 'Every artist was first an amateur.', author: 'Ralph Waldo Emerson', category: 'motivation' },
  { id: 'm-free', text: 'I am no bird; and no net ensnares me: I am a free human being with an independent will.', author: 'Charlotte Brontë', source: 'Jane Eyre', category: 'motivation' },
  { id: 'm-keep-head', text: 'If you can keep your head when all about you\nAre losing theirs and blaming it on you…', author: 'Rudyard Kipling', source: 'If—', category: 'motivation' },
  { id: 'm-finish-day', text: 'Finish each day and be done with it.', author: 'Ralph Waldo Emerson', category: 'motivation' },
  { id: 'm-begin', text: 'Begin at the beginning, and go on till you come to the end: then stop.', author: 'Lewis Carroll', source: "Alice's Adventures in Wonderland", category: 'motivation' },

  // ---------- Learning ----------
  { id: 'l-perseverance', text: 'Is it not pleasant to learn with a constant perseverance and application?', author: 'Confucius', source: LEGGE_ANALECTS, category: 'learning' },
  { id: 'l-knowledge', text: 'When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it—this is knowledge.', author: 'Confucius', source: LEGGE_ANALECTS, category: 'learning' },
  { id: 'l-thought', text: 'Learning without thought is labour lost; thought without learning is perilous.', author: 'Confucius', source: LEGGE_ANALECTS, category: 'learning' },
  { id: 'l-power', text: 'Knowledge is power.', author: 'Francis Bacon', category: 'learning' },
  { id: 'l-reading-maketh', text: 'Reading maketh a full man; conference a ready man; and writing an exact man.', author: 'Francis Bacon', source: 'Of Studies', category: 'learning' },
  { id: 'l-books-tasted', text: 'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.', author: 'Francis Bacon', source: 'Of Studies', category: 'learning' },
  { id: 'l-little-learning', text: 'A little learning is a dangerous thing.', author: 'Alexander Pope', source: 'An Essay on Criticism', category: 'learning' },
  { id: 'l-giants', text: 'If I have seen further it is by standing on the shoulders of Giants.', author: 'Isaac Newton', source: 'Letter to Robert Hooke, 1675', category: 'learning' },
  { id: 'l-reading', text: 'I declare after all there is no enjoyment like reading!', author: 'Jane Austen', source: 'Pride and Prejudice', category: 'learning' },
  { id: 'l-books', text: 'I cannot live without books.', author: 'Thomas Jefferson', source: 'Letter to John Adams, 1815', category: 'learning' },
  { id: 'l-experienced', text: 'Nothing ever becomes real till it is experienced.', author: 'John Keats', source: 'Letter, 1819', category: 'learning' },
  { id: 'l-nature-teacher', text: 'Come forth into the light of things,\nLet Nature be your teacher.', author: 'William Wordsworth', source: 'The Tables Turned', category: 'learning' },
  { id: 'l-prejudices', text: 'It is never too late to give up our prejudices.', author: 'Henry David Thoreau', source: 'Walden', category: 'learning' },
  { id: 'l-years-teach', text: 'The years teach much which the days never know.', author: 'Ralph Waldo Emerson', source: 'Experience', category: 'learning' },
  { id: 'l-experience', text: 'Experience is the name every one gives to their mistakes.', author: 'Oscar Wilde', source: "Lady Windermere's Fan", category: 'learning' },
  { id: 'l-impossible', text: "Why, sometimes I've believed as many as six impossible things before breakfast.", author: 'Lewis Carroll', source: 'Through the Looking-Glass', category: 'learning' },
  { id: 'l-yesterday', text: "It's no use going back to yesterday, because I was a different person then.", author: 'Lewis Carroll', source: "Alice's Adventures in Wonderland", category: 'learning' },
  { id: 'l-re-examine', text: 'Re-examine all you have been told at school or church or in any book, dismiss whatever insults your own soul.', author: 'Walt Whitman', source: 'Leaves of Grass, preface', category: 'learning' },
  { id: 'l-truth', text: 'Rather than love, than money, than fame, give me truth.', author: 'Henry David Thoreau', source: 'Walden', category: 'learning' },
  { id: 'l-choice', text: 'The strongest principle of growth lies in human choice.', author: 'George Eliot', source: 'Daniel Deronda', category: 'learning' },
  { id: 'l-truth-fiction', text: "Truth is stranger than fiction, but it is because Fiction is obliged to stick to possibilities; Truth isn't.", author: 'Mark Twain', source: 'Following the Equator', category: 'learning' },

  // ---------- Calm ----------
  { id: 'c-simplify', text: 'Our life is frittered away by detail… Simplify, simplify.', author: 'Henry David Thoreau', source: 'Walden', category: 'calm' },
  { id: 'c-deliberately', text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life.', author: 'Henry David Thoreau', source: 'Walden', category: 'calm' },
  { id: 'c-we-change', text: 'Things do not change; we change.', author: 'Henry David Thoreau', source: 'Walden', category: 'calm' },
  { id: 'c-heaven-feet', text: 'Heaven is under our feet as well as over our heads.', author: 'Henry David Thoreau', source: 'Walden', category: 'calm' },
  { id: 'c-patience', text: 'Adopt the pace of nature: her secret is patience.', author: 'Ralph Waldo Emerson', source: 'Education', category: 'calm' },
  { id: 'c-happy-life', text: 'Very little indeed is necessary for living a happy life.', author: 'Marcus Aurelius', source: LONG_MEDITATIONS, category: 'calm' },
  { id: 'c-opinion', text: 'The universe is transformation: life is opinion.', author: 'Marcus Aurelius', source: LONG_MEDITATIONS, category: 'calm' },
  { id: 'c-disturbed', text: 'Men are disturbed not by the things which happen, but by the opinions about the things.', author: 'Epictetus', source: 'Enchiridion, tr. George Long', category: 'calm' },
  { id: 'c-time-ours', text: 'Nothing, Lucilius, is ours, except time.', author: 'Seneca', source: GUMMERE, category: 'calm' },
  { id: 'c-thinking', text: 'There is nothing either good or bad, but thinking makes it so.', author: 'William Shakespeare', source: 'Hamlet', category: 'calm' },
  { id: 'c-wisely-slow', text: 'Wisely and slow; they stumble that run fast.', author: 'William Shakespeare', source: 'Romeo and Juliet', category: 'calm' },
  { id: 'c-own-self', text: 'This above all: to thine own self be true.', author: 'William Shakespeare', source: 'Hamlet', category: 'calm' },
  { id: 'c-knows-himself', text: 'He who knows other men is discerning; he who knows himself is intelligent.', author: 'Lao Tzu', source: LEGGE_TAO, category: 'calm' },
  { id: 'c-mind-place', text: "The mind is its own place, and in itself\nCan make a Heav'n of Hell, a Hell of Heav'n.", author: 'John Milton', source: 'Paradise Lost', category: 'calm' },
  { id: 'c-stand-wait', text: 'They also serve who only stand and wait.', author: 'John Milton', source: 'On His Blindness', category: 'calm' },
  { id: 'c-rain', text: 'Into each life some rain must fall.', author: 'Henry Wadsworth Longfellow', source: 'The Rainy Day', category: 'calm' },
  { id: 'c-spring', text: 'If Winter comes, can Spring be far behind?', author: 'Percy Bysshe Shelley', source: 'Ode to the West Wind', category: 'calm' },
  { id: 'c-staying-home', text: 'There is nothing like staying at home for real comfort.', author: 'Jane Austen', source: 'Emma', category: 'calm' },
  { id: 'c-forget-smile', text: 'Better by far you should forget and smile\nThan that you should remember and be sad.', author: 'Christina Rossetti', source: 'Remember', category: 'calm' },
  { id: 'c-travel-hopefully', text: 'To travel hopefully is a better thing than to arrive.', author: 'Robert Louis Stevenson', source: 'El Dorado', category: 'calm' },
  { id: 'c-nows', text: 'Forever is composed of nows.', author: 'Emily Dickinson', category: 'calm' },
  { id: 'c-pillow', text: 'Fatigue is the best pillow.', author: 'Benjamin Franklin', source: PRA, category: 'calm' },
  { id: 'c-new-day', text: "Isn't it nice to think that tomorrow is a new day with no mistakes in it yet?", author: 'L. M. Montgomery', source: 'Anne of Green Gables', category: 'calm' },
  { id: 'c-hope-springs', text: 'Hope springs eternal in the human breast.', author: 'Alexander Pope', source: 'An Essay on Man', category: 'calm' },
  { id: 'c-hope-feathers', text: '"Hope" is the thing with feathers\nThat perches in the soul.', author: 'Emily Dickinson', category: 'calm' },
  { id: 'c-dawn', text: 'Not knowing when the Dawn will come,\nI open every Door.', author: 'Emily Dickinson', category: 'calm' },

  // ---------- Kindness ----------
  { id: 'k-friend', text: 'The only way to have a friend is to be one.', author: 'Ralph Waldo Emerson', source: 'Friendship', category: 'kindness' },
  { id: 'k-candle', text: 'How far that little candle throws his beams!\nSo shines a good deed in a weary world.', author: 'William Shakespeare', source: 'The Merchant of Venice', category: 'kindness' },
  { id: 'k-love-all', text: 'Love all, trust a few,\nDo wrong to none.', author: 'William Shakespeare', source: "All's Well That Ends Well", category: 'kindness' },
  { id: 'k-tenderness', text: 'There is no charm equal to tenderness of heart.', author: 'Jane Austen', source: 'Emma', category: 'kindness' },
  { id: 'k-useless', text: 'No one is useless in this world who lightens the burden of it for any one else.', author: 'Charles Dickens', source: 'Our Mutual Friend', category: 'kindness' },
  { id: 'k-heart', text: 'Have a heart that never hardens, and a temper that never tires, and a touch that never hurts.', author: 'Charles Dickens', source: 'Our Mutual Friend', category: 'kindness' },
  { id: 'k-err', text: 'To err is human, to forgive divine.', author: 'Alexander Pope', source: 'An Essay on Criticism', category: 'kindness' },
  { id: 'k-golden', text: 'What you do not want done to yourself, do not do to others.', author: 'Confucius', source: LEGGE_ANALECTS, category: 'kindness' },
  { id: 'k-malice', text: 'With malice toward none, with charity for all.', author: 'Abraham Lincoln', source: 'Second Inaugural Address', category: 'kindness' },
  { id: 'k-less-difficult', text: 'What do we live for, if it is not to make life less difficult to each other?', author: 'George Eliot', source: 'Middlemarch', category: 'kindness' },
  { id: 'k-island', text: 'No man is an island, entire of itself.', author: 'John Donne', source: 'Meditation XVII', category: 'kindness' },
  { id: 'k-cheer', text: 'The best way to cheer yourself up is to try to cheer somebody else up.', author: 'Mark Twain', category: 'kindness' },
  { id: 'k-do-right', text: 'Always do right. This will gratify some people and astonish the rest.', author: 'Mark Twain', category: 'kindness' },
  { id: 'k-friend-need', text: 'A friend in need is a friend indeed.', author: 'Proverb', category: 'kindness' },
  { id: 'k-many-hands', text: 'Many hands make light work.', author: 'Proverb', category: 'kindness' },
  { id: 'k-rose', text: 'Where you tend a rose, my lad, a thistle cannot grow.', author: 'Frances Hodgson Burnett', source: 'The Secret Garden', category: 'kindness' },
  { id: 'k-loved-lost', text: "'Tis better to have loved and lost\nThan never to have loved at all.", author: 'Alfred, Lord Tennyson', source: 'In Memoriam A.H.H.', category: 'kindness' },

  // ---------- Joy & wonder ----------
  { id: 'j-beauty', text: 'A thing of beauty is a joy for ever.', author: 'John Keats', source: 'Endymion', category: 'joy' },
  { id: 'j-grain-sand', text: 'To see a World in a Grain of Sand\nAnd a Heaven in a Wild Flower.', author: 'William Blake', source: 'Auguries of Innocence', category: 'joy' },
  { id: 'j-energy', text: 'Energy is Eternal Delight.', author: 'William Blake', source: 'The Marriage of Heaven and Hell', category: 'joy' },
  { id: 'j-best-day', text: 'Write it on your heart that every day is the best day in the year.', author: 'Ralph Waldo Emerson', source: 'Works and Days', category: 'joy' },
  { id: 'j-octobers', text: "I'm so glad I live in a world where there are Octobers.", author: 'L. M. Montgomery', source: 'Anne of Green Gables', category: 'joy' },
  { id: 'j-garden', text: 'If you look the right way, you can see that the whole world is a garden.', author: 'Frances Hodgson Burnett', source: 'The Secret Garden', category: 'joy' },
  { id: 'j-startling', text: 'To live is so startling it leaves but little room for other occupations.', author: 'Emily Dickinson', source: 'Letter', category: 'joy' },
  { id: 'j-possibility', text: 'I dwell in Possibility.', author: 'Emily Dickinson', category: 'joy' },
  { id: 'j-multitudes', text: 'Do I contradict myself?\nVery well then I contradict myself,\n(I am large, I contain multitudes.)', author: 'Walt Whitman', source: 'Song of Myself', category: 'joy' },
  { id: 'j-stars', text: 'We are all in the gutter, but some of us are looking at the stars.', author: 'Oscar Wilde', source: "Lady Windermere's Fan", category: 'joy' },
  { id: 'j-romance', text: 'To love oneself is the beginning of a lifelong romance.', author: 'Oscar Wilde', source: 'An Ideal Husband', category: 'joy' },
  { id: 'j-happy', text: 'I would always rather be happy than dignified.', author: 'Charlotte Brontë', source: 'Jane Eyre', category: 'joy' },
  { id: 'j-know-happiness', text: 'Know your own happiness.', author: 'Jane Austen', source: 'Sense and Sensibility', category: 'joy' },
  { id: 'j-wealth', text: 'There is no wealth but life.', author: 'John Ruskin', source: 'Unto This Last', category: 'joy' },
  { id: 'j-work', text: 'Blessed is he who has found his work; let him ask no other blessedness.', author: 'Thomas Carlyle', source: 'Past and Present', category: 'joy' },
  { id: 'j-all-days', text: 'May you live all the days of your life.', author: 'Jonathan Swift', source: 'Polite Conversation', category: 'joy' },
  { id: 'j-child', text: 'The Child is father of the Man.', author: 'William Wordsworth', source: 'My Heart Leaps Up', category: 'joy' },
  { id: 'j-undertaker', text: 'Let us endeavor so to live that when we come to die even the undertaker will be sorry.', author: 'Mark Twain', source: "Pudd'nhead Wilson", category: 'joy' },
  { id: 'j-housekeeping', text: "Housekeeping ain't no joke.", author: 'Louisa May Alcott', source: 'Little Women', category: 'joy' },
  { id: 'j-silver-lining', text: 'Every cloud has a silver lining.', author: 'Proverb', category: 'joy' },
];

export const quoteById = (id: string) => QUOTES.find((q) => q.id === id);
