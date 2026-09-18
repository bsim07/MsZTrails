/* ================= DATA ================= */

// Every fractling has its own 4 reflection strategies, tailored to its question type.
// Position in the array always means the same CATEGORY across all fractlings, so the
// end-screen summary can group them meaningfully:
//   [0] = applied a fraction rule/procedure   [1] = visualised / drew it
//   [2] = used another working method          [3] = guessed
const FRACTLINGS = [
  {
    id:0, name:"Halvo", tag:"Shading Type", num:1, den:2, color:"#4EC1A5", ear:"#2E9C81",
    question:"This shape is split into equal parts and half of it is shaded. What fraction is shaded?",
    options:["1/2","1/3","2/1","1/4"], correct:0,
    hint:"Count how many equal parts make up the WHOLE shape, then count how many are shaded.",
    explain:"The whole is cut into 2 equal parts (denominator = 2). 1 part is shaded (numerator = 1). So the fraction shaded is <b>1/2</b>.",
    strategies:[
      "I counted the total equal parts for the denominator, then the shaded parts for the numerator.",
      "I pictured the shape split into equal pieces in my head.",
      "I looked at the answer choices and eliminated the ones that didn't make sense.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:1, name:"Triqua", tag:"Shading Type", num:1, den:3, color:"#F2A65A", ear:"#D6863A",
    question:"A pizza is cut into 3 equal slices. Mia eats 1 slice. What fraction of the pizza did she eat?",
    options:["1/3","1/2","3/1","2/3"], correct:0,
    hint:"The denominator is the total number of equal slices. The numerator is how many Mia ate.",
    explain:"Total equal slices = denominator = 3. Slices Mia ate = numerator = 1. So she ate <b>1/3</b> of the pizza.",
    strategies:[
      "I used total slices as the denominator and slices eaten as the numerator.",
      "I pictured the pizza cut into slices, like a real pizza.",
      "I said the answer out loud in words first, then wrote it as a fraction.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:2, name:"Quadrin", tag:"Compare Type", num:4, den:5, color:"#8E7CE0", ear:"#6B54C4",
    question:"Which fraction is greater: 3/5 or 4/5?",
    options:["3/5","4/5","They are equal","Cannot tell"], correct:1,
    hint:"When the denominators are the SAME, just compare the numerators (top numbers).",
    explain:"Both fractions are out of 5 equal parts, so compare the numerators: 4 is greater than 3. That means <b>4/5 &gt; 3/5</b> — more equal parts are being taken.",
    strategies:[
      "I compared the numerators because the denominators were the same.",
      "I pictured both fractions as bars or circles and compared the shaded parts.",
      "I checked which fraction was closer to a whole.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:3, name:"Ordelle", tag:"Ordering Type", num:5, den:6, color:"#4E9FDA", ear:"#3576A8",
    question:"Arrange these from SMALLEST to LARGEST: 2/6, 5/6, 1/6",
    options:["1/6, 2/6, 5/6","5/6, 2/6, 1/6","2/6, 1/6, 5/6","5/6, 1/6, 2/6"], correct:0,
    hint:"Same denominator (6) for all — just put the numerators in order: 1, 2, 5.",
    explain:"All three fractions share the same denominator, 6, so we only need to order the numerators: 1 &lt; 2 &lt; 5. That gives us <b>1/6, 2/6, 5/6</b>.",
    strategies:[
      "I compared the numerators since all the denominators were the same.",
      "I pictured each fraction and lined them up from smallest to largest.",
      "I listed just the numerators first, ordered them, then rewrote the fractions.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:4, name:"Addix", tag:"Addition Type", num:5, den:7, color:"#FF9F5A", ear:"#DD7B33",
    question:"2/7 + 3/7 = ?",
    options:["5/7","5/14","1/7","6/7"], correct:0,
    hint:"Same denominator? Add the numerators only, and keep the denominator the same.",
    explain:"Since both fractions are out of 7, we add just the numerators: 2 + 3 = 5. The denominator stays the same. So 2/7 + 3/7 = <b>5/7</b>.",
    strategies:[
      "I added the numerators and kept the denominator the same.",
      "I pictured combining the two groups of parts together.",
      "I counted on using my fingers or a number line.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:5, name:"Subtra", tag:"Subtraction Type", num:4, den:9, color:"#E0637A", ear:"#B84156",
    question:"6/9 − 2/9 = ?",
    options:["4/9","4/0","8/9","3/9"], correct:0,
    hint:"Same denominator — subtract the numerators only, and keep the denominator the same.",
    explain:"Both fractions are out of 9, so subtract the numerators: 6 − 2 = 4. The denominator stays the same. So 6/9 − 2/9 = <b>4/9</b>.",
    strategies:[
      "I subtracted the numerators and kept the denominator the same.",
      "I pictured taking parts away from the whole group.",
      "I counted backwards from 6 to check the difference.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:6, name:"Wordlet", tag:"Word Problem", num:5, den:8, color:"#E07CC2", ear:"#B95498",
    question:"Sam ate 2/8 of a cake. His sister ate 3/8 of the same cake. What fraction of the cake did they eat altogether?",
    options:["5/8","5/16","1/8","6/8"], correct:0,
    hint:"Both fractions are parts of the SAME cake (same denominator, 8) — add the numerators.",
    explain:"They shared the same whole cake, cut into 8 equal parts. Add the numerators: 2 + 3 = 5. So together they ate <b>5/8</b> of the cake.",
    strategies:[
      "I noticed both fractions were parts of the same whole, then added the numerators.",
      "I drew a picture of the cake being shared to help me.",
      "I turned the words into a number sentence and solved it.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:7, name:"Setto", tag:"Fraction of a Set", num:1, den:4, color:"#E8C94E", ear:"#C7A82E",
    question:"There are 12 sweets. 1/4 of them are red. How many sweets are red?",
    options:["3","4","6","12"], correct:0,
    hint:"Split the 12 sweets into 4 equal groups first, then take just 1 group.",
    explain:"1/4 of 12 means dividing 12 into 4 equal groups: 12 ÷ 4 = 3 sweets per group. Taking 1 group gives <b>3</b> red sweets.",
    strategies:[
      "I divided the total into equal groups first, then took the number of groups I needed.",
      "I drew or grouped the sweets into 4 piles to help me count.",
      "I used a division fact I already knew (12 ÷ 4).",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:8, name:"Nearone", tag:"Near-A-Whole Type", num:4, den:5, color:"#63C97D", ear:"#3FA25B",
    question:"Which fraction is closest to 1 whole? 2/5, 4/5, 1/5, 3/5",
    options:["2/5","4/5","1/5","3/5"], correct:1,
    hint:"Same denominator — the fraction with the BIGGEST numerator is closest to the whole (5/5 = 1).",
    explain:"All are out of 5. The bigger the numerator, the closer the fraction is to 5/5 (a whole). 4 is the biggest numerator here, so <b>4/5</b> is closest to 1.",
    strategies:[
      "I compared the numerators — the biggest one is closest to a whole (5/5).",
      "I pictured each fraction and saw which had the smallest empty part left.",
      "I worked out how far each fraction was from a whole and compared.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:9, name:"Partly", tag:"Vocabulary Type", num:3, den:7, color:"#A9825A", ear:"#8A6742",
    question:"In the fraction 3/7, what does the 7 represent?",
    options:["Total equal parts the whole is divided into","Number of parts shaded","Number of parts NOT shaded","The value of the fraction"], correct:0,
    hint:"The bottom number is called the denominator. Think about what 'equal parts' means.",
    explain:"The bottom number (denominator) shows how many equal parts make up the WHOLE. The top number (numerator) shows how many of those parts we are looking at. So 7 is the <b>total equal parts</b>.",
    strategies:[
      "I recalled what the word 'denominator' means.",
      "I pictured a real example, like pizza slices, to remind myself.",
      "I eliminated the options that clearly didn't make sense.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:10, name:"Halfmark", tag:"Benchmark Type", num:3, den:8, color:"#5CBEDB", ear:"#3A96B3",
    question:"Is 3/8 more than, less than, or exactly 1/2?",
    options:["Less than 1/2","More than 1/2","Exactly 1/2","Cannot tell"], correct:0,
    hint:"Half of 8 is 4. Is the numerator (3) more or less than 4?",
    explain:"Half of the denominator 8 is 4, so 4/8 would equal 1/2. Since the numerator 3 is less than 4, <b>3/8 is less than 1/2</b>.",
    strategies:[
      "I found half of the denominator and compared it to the numerator.",
      "I pictured the fraction on a bar and checked which side of the middle it landed on.",
      "I converted both to the same denominator to compare.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:11, name:"Groupzy", tag:"Fraction of a Set", num:1, den:5, color:"#E8A13F", ear:"#C77F22",
    question:"There are 20 stickers. 1/5 of them are gold. How many stickers are gold?",
    options:["4","5","15","20"], correct:0,
    hint:"Split the 20 stickers into 5 equal groups first, then take just 1 group.",
    explain:"1/5 of 20 means dividing 20 into 5 equal groups: 20 ÷ 5 = 4 stickers per group. Taking 1 group gives <b>4</b> gold stickers.",
    strategies:[
      "I divided the total into equal groups first, then took the number of groups I needed.",
      "I drew or grouped the stickers into 5 piles to help me count.",
      "I used a division fact I already knew (20 ÷ 5).",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:12, name:"Subtrix", tag:"Subtraction Type", num:3, den:11, color:"#C25B7A", ear:"#9E3E5C",
    question:"8/11 − 5/11 = ?",
    options:["3/11","3/0","13/11","8/22"], correct:0,
    hint:"Same denominator — subtract the numerators only, and keep the denominator the same.",
    explain:"Both fractions are out of 11, so subtract the numerators: 8 − 5 = 3. The denominator stays the same. So 8/11 − 5/11 = <b>3/11</b>.",
    strategies:[
      "I subtracted the numerators and kept the denominator the same.",
      "I pictured taking parts away from the whole group.",
      "I counted backwards from 8 to check the difference.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:13, name:"Addelle", tag:"Word Problem", num:3, den:6, color:"#7FBF6B", ear:"#569943",
    question:"Ben read 1/6 of a book on Monday and 2/6 more on Tuesday. What fraction of the book has he read in total?",
    options:["3/6","3/12","1/6","2/6"], correct:0,
    hint:"Both fractions are parts of the SAME book (same denominator, 6) — add the numerators.",
    explain:"Both days are parts of the same whole book, cut into 6 equal parts. Add the numerators: 1 + 2 = 3. So altogether he's read <b>3/6</b> of the book.",
    strategies:[
      "I noticed both fractions were parts of the same whole, then added the numerators.",
      "I drew a picture of the book being read bit by bit.",
      "I turned the words into a number sentence and solved it.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:14, name:"Lineup", tag:"Ordering Type", num:7, den:8, color:"#9C7FE0", ear:"#7857BE",
    question:"Arrange these from LARGEST to SMALLEST: 3/8, 7/8, 5/8",
    options:["7/8, 5/8, 3/8","3/8, 5/8, 7/8","5/8, 7/8, 3/8","7/8, 3/8, 5/8"], correct:0,
    hint:"Same denominator (8) for all — just put the numerators in order from biggest to smallest: 7, 5, 3.",
    explain:"All three fractions share the same denominator, 8, so we only need to order the numerators from biggest to smallest: 7 &gt; 5 &gt; 3. That gives us <b>7/8, 5/8, 3/8</b>.",
    strategies:[
      "I compared the numerators since all the denominators were the same.",
      "I pictured each fraction and lined them up from largest to smallest.",
      "I listed just the numerators first, ordered them, then rewrote the fractions.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:15, name:"Wholesome", tag:"Vocabulary Type", num:4, den:4, color:"#4EA695", ear:"#33796C",
    question:"Which of these fractions is equal to ONE WHOLE?",
    options:["4/4","3/4","1/4","2/4"], correct:0,
    hint:"A fraction equals one whole when the numerator and denominator are the SAME number.",
    explain:"When the numerator equals the denominator, every equal part is included — that's the whole thing! So <b>4/4</b> equals 1 whole.",
    strategies:[
      "I checked which fraction had a numerator equal to its denominator.",
      "I pictured each fraction as a shape and saw which one was fully shaded.",
      "I eliminated the options that clearly didn't make sense.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:16, name:"Sumora", tag:"Addition Type", num:7, den:9, color:"#6FA8DC", ear:"#4C82B8",
    question:"3/9 + 4/9 = ?",
    options:["7/9","7/18","1/9","8/9"], correct:0,
    hint:"Same denominator? Add the numerators only, and keep the denominator the same.",
    explain:"Both fractions are out of 9, so add just the numerators: 3 + 4 = 7. The denominator stays the same. So 3/9 + 4/9 = <b>7/9</b>.",
    strategies:[
      "I added the numerators and kept the denominator the same.",
      "I pictured combining the two groups of parts together.",
      "I counted on using my fingers or a number line.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:17, name:"Plusix", tag:"Addition Type", num:3, den:5, color:"#E8955C", ear:"#C97538",
    question:"1/5 + 2/5 = ?",
    options:["3/5","3/10","1/5","4/5"], correct:0,
    hint:"Same denominator — add the numerators, keep the denominator the same.",
    explain:"Both fractions are out of 5, so add just the numerators: 1 + 2 = 3. So 1/5 + 2/5 = <b>3/5</b>.",
    strategies:[
      "I added the numerators and kept the denominator the same.",
      "I pictured combining the two groups of parts together.",
      "I counted on using my fingers or a number line.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:18, name:"Combino", tag:"Addition Type", num:7, den:10, color:"#7ED9A6", ear:"#4FAE7C",
    question:"4/10 + 3/10 = ?",
    options:["7/10","7/20","1/10","8/10"], correct:0,
    hint:"Add the numerators only; the denominator (10) doesn't change.",
    explain:"Both fractions are out of 10, so add just the numerators: 4 + 3 = 7. So 4/10 + 3/10 = <b>7/10</b>.",
    strategies:[
      "I added the numerators and kept the denominator the same.",
      "I pictured combining the two groups of parts together.",
      "I counted on using my fingers or a number line.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:19, name:"Minuso", tag:"Subtraction Type", num:5, den:10, color:"#D97BA6", ear:"#B2547F",
    question:"9/10 − 4/10 = ?",
    options:["5/10","5/0","13/10","4/10"], correct:0,
    hint:"Same denominator — subtract the numerators only, keep the denominator the same.",
    explain:"Both fractions are out of 10, so subtract just the numerators: 9 − 4 = 5. So 9/10 − 4/10 = <b>5/10</b>.",
    strategies:[
      "I subtracted the numerators and kept the denominator the same.",
      "I pictured taking parts away from the whole group.",
      "I counted backwards to check the difference.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:20, name:"Takeway", tag:"Subtraction Type", num:4, den:8, color:"#A87BD9", ear:"#8154B2",
    question:"7/8 − 3/8 = ?",
    options:["4/8","4/0","10/8","3/8"], correct:0,
    hint:"Subtract the numerators only; the denominator (8) doesn't change.",
    explain:"Both fractions are out of 8, so subtract just the numerators: 7 − 3 = 4. So 7/8 − 3/8 = <b>4/8</b>.",
    strategies:[
      "I subtracted the numerators and kept the denominator the same.",
      "I pictured taking parts away from the whole group.",
      "I counted backwards to check the difference.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:21, name:"Storyfrac", tag:"Word Problem", num:3, den:4, color:"#6BC7C1", ear:"#489B95",
    question:"Mei drank 1/4 of a bottle in the morning and 2/4 more in the afternoon. What fraction has she drunk altogether?",
    options:["3/4","3/8","1/4","2/4"], correct:0,
    hint:"Both fractions are parts of the SAME bottle (same denominator) — add the numerators.",
    explain:"Both amounts are parts of the same bottle, cut into 4 equal parts. Add the numerators: 1 + 2 = 3. So altogether she drank <b>3/4</b> of the bottle.",
    strategies:[
      "I noticed both fractions were parts of the same whole, then added the numerators.",
      "I drew a picture to help me work it out.",
      "I turned the words into a number sentence and solved it.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:22, name:"Talebit", tag:"Word Problem", num:3, den:10, color:"#E0B15C", ear:"#B98A36",
    question:"A tank is 7/10 full. Dad adds water so it becomes completely full. What fraction of water did Dad add?",
    options:["3/10","7/10","10/10","4/10"], correct:0,
    hint:"The tank started at 7/10. Think about how much MORE is needed to reach 10/10.",
    explain:"A full tank is 10/10. It started at 7/10, so Dad needed to add 10/10 − 7/10 = <b>3/10</b> to fill it.",
    strategies:[
      "I thought of the whole tank as 10/10 and subtracted what was already there.",
      "I drew a picture to help me work it out.",
      "I turned the words into a number sentence and solved it.",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:23, name:"Sharemint", tag:"Fraction of a Set", num:1, den:3, color:"#7C9BE0", ear:"#5A78BE",
    question:"There are 18 marbles. 1/3 of them are blue. How many marbles are blue?",
    options:["6","3","9","18"], correct:0,
    hint:"Split the 18 marbles into 3 equal groups first, then take just 1 group.",
    explain:"1/3 of 18 means dividing 18 into 3 equal groups: 18 ÷ 3 = 6 marbles per group. Taking 1 group gives <b>6</b> blue marbles.",
    strategies:[
      "I divided the total into equal groups first, then took the number of groups I needed.",
      "I drew or grouped the marbles to help me count.",
      "I used a division fact I already knew (18 ÷ 3).",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
  {
    id:24, name:"Piecewise", tag:"Fraction of a Set", num:1, den:6, color:"#D9A05C", ear:"#B37D3A",
    question:"A box has 24 pencils. 1/6 of them are red. How many pencils are red?",
    options:["4","6","3","24"], correct:0,
    hint:"Split the 24 pencils into 6 equal groups first, then take just 1 group.",
    explain:"1/6 of 24 means dividing 24 into 6 equal groups: 24 ÷ 6 = 4 pencils per group. Taking 1 group gives <b>4</b> red pencils.",
    strategies:[
      "I divided the total into equal groups first, then took the number of groups I needed.",
      "I drew or grouped the pencils to help me count.",
      "I used a division fact I already knew (24 ÷ 6).",
      "I wasn't fully sure, so I made my best guess."
    ]
  },
];

// A separate, tougher pool used only for Rival Trainer battles — these ask students to
// combine two ideas (e.g. work out a fraction AND find what's left), so they feel like a
// genuine step up from the wild Fractling questions rather than a repeat of them.
const TRAINER_POOL = [
  {
    name:"Cake Split", tag:"Two-Step", num:4, den:9, color:"#E0637A", ear:"#B84156",
    question:"Mrs Tan cut a cake into 9 equal pieces. She gave 2/9 to her neighbour and 3/9 to her sister. What fraction of the cake is LEFT?",
    options:["4/9","5/9","9/9","1/9"], correct:0,
    explain:"The whole cake is 9/9. She gave away 2/9 + 3/9 = 5/9. What's left is 9/9 − 5/9 = <b>4/9</b>."
  },
  {
    name:"Equal Match", tag:"Equivalent Fractions", num:2, den:4, color:"#8E7CE0", ear:"#6B54C4",
    question:"Which fraction is equivalent to 1/2?",
    options:["2/4","2/3","3/5","1/3"], correct:0,
    explain:"A fraction equals 1/2 when the numerator is exactly half the denominator. 2 is half of 4, so <b>2/4 = 1/2</b>."
  },
  {
    name:"Ribbon Cut", tag:"Two-Step", num:2, den:3, color:"#F2A65A", ear:"#D6863A",
    question:"A ribbon is 12m long. Raj cuts off 1/3 of it to make a bow. How many metres are LEFT?",
    options:["8m","4m","3m","9m"], correct:0,
    explain:"1/3 of 12m is 12 ÷ 3 = 4m cut off. What's left is 12m − 4m = <b>8m</b>."
  },
  {
    name:"Whole Check", tag:"Vocabulary", num:3, den:4, color:"#4EA695", ear:"#33796C",
    question:"Which of these fractions is NOT equal to one whole?",
    options:["3/4","5/5","6/6","3/3"], correct:0,
    explain:"A fraction equals a whole only when the numerator equals the denominator. In 3/4, 3 ≠ 4, so it is <b>not</b> a whole."
  },
  {
    name:"Juice Box", tag:"Two-Step", num:3, den:6, color:"#5CBEDB", ear:"#3A96B3",
    question:"Aisyah drank 2/6 of a bottle of juice in the morning and 1/6 more in the afternoon. What fraction of the juice has she NOT drunk?",
    options:["3/6","4/6","2/6","1/6"], correct:0,
    explain:"She drank 2/6 + 1/6 = 3/6 in total. The whole bottle is 6/6, so what's left is 6/6 − 3/6 = <b>3/6</b>."
  },
  {
    name:"Order Check", tag:"Ordering", num:7, den:10, color:"#9C7FE0", ear:"#7857BE",
    question:"Which list is correctly ordered from LARGEST to SMALLEST?",
    options:["7/10, 4/10, 2/10","2/10, 4/10, 7/10","4/10, 7/10, 2/10","7/10, 2/10, 4/10"], correct:0,
    explain:"Same denominator (10), so order the numerators from biggest to smallest: 7, 4, 2 — giving <b>7/10, 4/10, 2/10</b>."
  },
  {
    name:"Sweet Count", tag:"Two-Step", num:2, den:5, color:"#E8A13F", ear:"#C77F22",
    question:"A pack has 15 sweets. 2/5 of them are chocolate. How many sweets are NOT chocolate?",
    options:["9","6","5","10"], correct:0,
    explain:"2/5 of 15 is (15 ÷ 5) × 2 = 6 chocolate sweets. The rest are 15 − 6 = <b>9</b> sweets that are not chocolate."
  },
  {
    name:"Closest Call", tag:"Near-A-Whole", num:5, den:6, color:"#63C97D", ear:"#3FA25B",
    question:"Which fraction is closest to 1 whole: 5/6, 3/6, 1/6, or 4/6?",
    options:["5/6","3/6","1/6","4/6"], correct:0,
    explain:"All are out of 6. The bigger the numerator, the closer to a whole (6/6). 5 is the biggest here, so <b>5/6</b> is closest."
  },
  {
    name:"Ribbon Leftover", tag:"Two-Step", num:3, den:8, color:"#E07CC2", ear:"#B95498",
    question:"Farah's ribbon is cut into 8 equal parts. She uses 3/8 for a bow and 2/8 for a bookmark. What fraction of the ribbon is UNUSED?",
    options:["3/8","5/8","1/8","6/8"], correct:0,
    explain:"She used 3/8 + 2/8 = 5/8 in total. The whole ribbon is 8/8, so what's unused is 8/8 − 5/8 = <b>3/8</b>."
  },
  {
    name:"Equal Pair", tag:"Equivalent Fractions", num:1, den:2, color:"#A9825A", ear:"#8A6742",
    question:"Which pair of fractions are equal in value?",
    options:["2/4 and 1/2","1/3 and 1/4","2/5 and 1/2","3/6 and 2/3"], correct:0,
    explain:"2 is half of 4, so 2/4 = 1/2 — they name the same amount, just cut into a different number of equal parts."
  },
];

// A THIRD pool, exclusive to the Level 3 Boss Battle. Every question here needs two or
// three reasoning steps chained together, or larger/less-familiar denominators — a real
// step up from both the wild Fractlings and the Rival Trainer questions — while staying
// strictly within P3 skills (fraction of a set, ordering/comparing like fractions,
// addition & subtraction of like fractions, and basic equivalent fractions). Nothing here
// requires working backwards from a part to find an unknown whole, which is a P4/P5 skill.
const BOSS_POOL = [
  {
    name:"Slice Trio", tag:"Three-Part Whole", num:3, den:12, color:"#C0392B", ear:"#922B21",
    question:"A cake is cut into 12 equal slices. Dev eats 3/12, his brother eats 4/12, and his sister eats 2/12. What fraction of the cake is LEFT?",
    options:["3/12","9/12","5/12","12/12"], correct:0,
    explain:"Together they ate 3/12 + 4/12 + 2/12 = 9/12. The whole cake is 12/12, so what's left is 12/12 − 9/12 = <b>3/12</b>."
  },
  {
    name:"Four in a Row", tag:"Ordering (4 fractions)", num:9, den:12, color:"#8E44AD", ear:"#6C3483",
    question:"Arrange these from SMALLEST to LARGEST: 5/12, 2/12, 9/12, 7/12",
    options:["2/12, 5/12, 7/12, 9/12","9/12, 7/12, 5/12, 2/12","5/12, 2/12, 9/12, 7/12","2/12, 9/12, 5/12, 7/12"], correct:0,
    explain:"Same denominator (12), so just order the numerators: 2 &lt; 5 &lt; 7 &lt; 9 — giving <b>2/12, 5/12, 7/12, 9/12</b>."
  },
  {
    name:"Shop Split", tag:"Fraction of a Set", num:3, den:5, color:"#D68910", ear:"#A66C0D",
    question:"A shop has 30 sweets. 2/5 of them are lollipops. The rest are chocolates. How many are chocolates?",
    options:["18","12","15","6"], correct:0,
    explain:"2/5 of 30 is (30 ÷ 5) × 2 = 12 lollipops. The rest are chocolates: 30 − 12 = <b>18</b>."
  },
  {
    name:"Gap Finder", tag:"Equivalent Fractions", num:6, den:8, color:"#2E86C1", ear:"#1B4F72",
    question:"3/4 is equivalent to ?/8. What is the missing numerator?",
    options:["6","3","4","8"], correct:0,
    explain:"To turn quarters into eighths, the denominator doubles (4 → 8), so the numerator doubles too: 3 × 2 = <b>6</b>. So 3/4 = 6/8."
  },
  {
    name:"Ribbon Relay", tag:"Two-Step", num:5, den:12, color:"#16A085", ear:"#0E6655",
    question:"A ribbon is 24m long. Mrs Lee cuts 1/3 of it for a bow, then cuts 1/4 of the ORIGINAL ribbon for a badge. How many metres of ribbon are left?",
    options:["10m","14m","8m","6m"], correct:0,
    explain:"1/3 of 24m = 8m for the bow. 1/4 of 24m = 6m for the badge. Together that's 8m + 6m = 14m used, so what's left is 24m − 14m = <b>10m</b>."
  },
  {
    name:"Furthest Out", tag:"Near-A-Whole", num:2, den:9, color:"#E74C3C", ear:"#B03A2E",
    question:"Which fraction is FURTHEST from 1 whole: 7/9, 8/9, 2/9, or 5/9?",
    options:["2/9","8/9","5/9","7/9"], correct:0,
    explain:"All are out of 9. The smaller the numerator, the further from a whole (9/9). 2 is the smallest numerator here, so <b>2/9</b> is furthest away."
  },
  {
    name:"Two Tanks", tag:"Comparing", num:2, den:8, color:"#2980B9", ear:"#1F618D",
    question:"Tank A is 5/8 full. Tank B is 3/8 full. How much MORE full is Tank A than Tank B?",
    options:["2/8","8/8","3/8","5/8"], correct:0,
    explain:"Both tanks are measured out of the same 8 equal parts, so subtract the numerators: 5 − 3 = 2. Tank A is <b>2/8</b> more full than Tank B."
  },
  {
    name:"Trip Sharing", tag:"Fraction of a Set", num:1, den:4, color:"#F39C12", ear:"#B9770E",
    question:"36 students went on a trip. 1/4 of them brought umbrellas and 1/6 of them brought raincoats. How many MORE students brought umbrellas than raincoats?",
    options:["3","9","6","15"], correct:0,
    explain:"1/4 of 36 = 9 umbrellas. 1/6 of 36 = 6 raincoats. The difference is 9 − 6 = <b>3</b> more students with umbrellas."
  },
  {
    name:"Full Circle", tag:"Working Backwards", num:4, den:6, color:"#7D3C98", ear:"#5B2C6F",
    question:"A pizza is cut into 6 equal slices. Ali eats some slices, leaving 2/6 of the pizza. What fraction of the pizza did Ali eat?",
    options:["4/6","2/6","6/6","3/6"], correct:0,
    explain:"The whole pizza is 6/6. If 2/6 is left, Ali ate 6/6 − 2/6 = <b>4/6</b> of the pizza."
  },
  {
    name:"Mixed Bag", tag:"Three-Part Set", num:11, den:20, color:"#27AE60", ear:"#1E8449",
    question:"A bag has 40 marbles: 1/5 are red, 1/4 are blue, and the rest are green. How many marbles are green?",
    options:["22","18","10","30"], correct:0,
    explain:"1/5 of 40 = 8 red. 1/4 of 40 = 10 blue. Together that's 8 + 10 = 18 marbles, so the rest are green: 40 − 18 = <b>22</b>."
  },
];


const CONFIDENCE = ["Not sure","Sort of sure","Very sure"];

const GUIDES = {
  N1:{ name:"Scholar Mei", avatar:"🧙‍♀️", tips:[
      "Remember: the <b>denominator</b> (bottom number) tells you how many EQUAL parts the whole is split into. The <b>numerator</b> (top number) tells you how many of those parts you have!",
      "A fraction is just a fair way to share — like splitting a chocolate bar equally among friends!",
      "Always check: are the parts really EQUAL? A fraction only works if every part is the same size.",
      "Try picturing a fraction as a pizza: the denominator is the number of slices, the numerator is how many you're looking at."
  ]},
  N2:{ name:"Scholar Zed", avatar:"🧙", tips:[
      "When two fractions have the <b>SAME denominator</b>, you can compare, add or subtract them just by working with the numerators — the denominator stays the same!",
      "To find a fraction of a number: divide first, then take that many groups. For 1/4 of 12, do 12 ÷ 4 = 3.",
      "The bigger the numerator (with the same denominator), the closer that fraction is to a whole!",
      "Adding or subtracting fractions? Only work with the top numbers if the bottom numbers already match — never touch the denominator!"
  ]},
};
const lastTipIndex = {};

const TRAINERS = {
  R1:{ name:"Trainer Kofi", avatar:"🥋",
       intro:"Ready for a Fraction Showdown? I'll fire 3 questions your way — get at least 2 right to earn my badge!" },
  R2:{ name:"Trainer Ines", avatar:"🥋",
       intro:"Think you know your fractions? Beat my 3-question challenge to earn my badge!" },
};

// Map is now a large, randomly-generated world that scrolls as the player walks.
// Characters used by the generator:
//   '#'=impassable tree border   '.'=path/walkable
// Map legend:
//   '#'=tree border (impassable)
//   '.'=dirt path (walkable)
//   'g'=plain grass (walkable)
//   'S#'=tall grass slot (walkable, may hold a Fractling)
//   'N#'=trail guide (walkable)
//   't'=thick trees (impassable)
//   'w'=water (impassable)
//   'f'=flowers (walkable)
//   'b'=bushes (walkable)
//   'r'=rocks (walkable)
//   'm'=mushrooms (walkable)
//   'h'=hill/mountain (impassable)
// Most terrain is now walkable; only border trees, thickets, water and mountains block movement.

const MAP_ROWS = 18;
const MAP_COLS = 26;
const VIEWPORT_ROWS = 7;
const VIEWPORT_COLS = 10;

function generateMap(){
  const rows = MAP_ROWS, cols = MAP_COLS;
  const map = Array.from({length:rows}, ()=>Array(cols).fill('g'));

  // 1. Border trees
  for(let r=0;r<rows;r++)
    for(let c=0;c<cols;c++)
      if(r===0||r===rows-1||c===0||c===cols-1) map[r][c]='#';

  // 2. Upper-left forest (rows 1-7, cols 1-7)
  //    2x2 tree blocks separated by 1-cell walkable gaps: tree when r%3!==0 && c%3!==0
  for(let r=1;r<=7;r++)
    for(let c=1;c<=7;c++)
      if(r%3!==0 && c%3!==0) map[r][c]='t';

  // 3. Lake (rows 1-4, cols 18-24)
  for(let r=1;r<=4;r++)
    for(let c=18;c<=24;c++)
      map[r][c]='w';

  // 4. Flower strip bordering the lake
  for(let c=18;c<=24;c++) map[5][c]='f';  // south shore
  for(let r=1;r<=4;r++) map[r][17]='f';   // west shore

  // 5. Main horizontal path (row 9, full inner width)
  for(let c=1;c<=24;c++) map[9][c]='.';

  // 6. Vertical path through the forest gap (col 8, rows 1-16 skipping row 9)
  for(let r=1;r<=16;r++) if(r!==9) map[r][8]='.';

  // 7. Second vertical path beside the lake (col 18, rows 5-8)
  for(let r=5;r<=8;r++) map[r][18]='.';

  // 8. Lower-right forest (rows 10-16, cols 15-24) — same 2x2 cluster pattern
  for(let r=10;r<=16;r++)
    for(let c=15;c<=24;c++)
      if(r%3!==0 && c%3!==0) map[r][c]='t';

  // 9. Tall grass encounter slots — many patches, only ten contain questions.
  // The extra patches are decoys so students must explore the whole field.
  const slotPositions = [];
  for(let r=1;r<rows-1;r++){
    for(let c=1;c<cols-1;c++){
      if(map[r][c]==='g') slotPositions.push([r,c]);
    }
  }
  slotPositions.sort(()=>Math.random()-0.5);
  let slotCount = 0;
  for(const [r,c] of slotPositions){
    if(slotCount>=32) break;
    if(map[r][c]==='g'){ map[r][c]='S'+slotCount; slotCount++; }
  }

  // 10. South open area decorations (rows 10-16, cols 1-7)
  [
    [10,2,'f'],[11,5,'f'],[12,7,'f'],[14,3,'f'],[15,6,'f'],
    [10,6,'r'],[12,4,'r'],[14,2,'r'],
    [11,3,'m'],[15,4,'m'],
    [10,4,'b'],[12,2,'b'],[13,7,'b'],[16,3,'b'],[16,6,'b'],
  ].forEach(([r,c,ch])=>{ if(map[r][c]==='g') map[r][c]=ch; });

  // 11. North area decorations near lake (rows 6-8, cols 16-24)
  [
    [6,20,'f'],[6,22,'f'],[7,19,'f'],[7,21,'f'],[7,23,'f'],
    [7,16,'r'],[8,16,'r'],
    [8,20,'b'],[8,22,'b'],
  ].forEach(([r,c,ch])=>{ if(map[r][c]==='g') map[r][c]=ch; });

  // 12. Random guide positions on walkable paths, away from the centre start.
  const guideCandidates = [];
  for(let r=2;r<rows-2;r++){
    for(let c=2;c<cols-2;c++){
      if(map[r][c]==='.' && Math.abs(r-9)+Math.abs(c-13)>=5) guideCandidates.push([r,c]);
    }
  }
  guideCandidates.sort(()=>Math.random()-0.5);
  if(guideCandidates[0]) map[guideCandidates[0][0]][guideCandidates[0][1]]='N1';
  if(guideCandidates[1]) map[guideCandidates[1][0]][guideCandidates[1][1]]='N2';

  return {map, slotCount};
}

let MAP_GEN = generateMap();
let MAP = MAP_GEN.map;
let TOTAL_SLOTS = MAP_GEN.slotCount;
let ROWS = MAP.length, COLS = MAP[0].length;
let START = {row:Math.floor(MAP_ROWS/2), col:Math.floor(MAP_COLS/2)};

function regenerateStart(){
  const candidates = [];
  for(let r=1;r<ROWS-1;r++){
    for(let c=1;c<COLS-1;c++){
      if(MAP[r][c] === '.') candidates.push({row:r, col:c});
    }
  }
  START = candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : {row:Math.floor(MAP_ROWS/2), col:Math.floor(MAP_COLS/2)};
}

// Ensure START is on a walkable path tile, preferring the centre clearing.
function ensureWalkableStart(){
  const centerR = Math.floor(MAP_ROWS/2), centerC = Math.floor(MAP_COLS/2);
  if(MAP[centerR] && MAP[centerR][centerC] === '.'){
    START = {row:centerR, col:centerC};
    return;
  }
  let guard = 0;
  while(MAP[START.row][START.col] !== '.' && guard < 100){
    regenerateStart();
    guard++;
  }
}
ensureWalkableStart();

// Grouped into 3 kid-friendly categories so the title-screen focus picker isn't overwhelming
const CATEGORY_GROUPS = [
  {key:'understand', label:'🔍 Naming & Comparing', tags:['Shading Type','Compare Type','Ordering Type','Benchmark Type','Near-A-Whole Type','Vocabulary Type']},
  {key:'addsub', label:'➕➖ Adding & Subtracting', tags:['Addition Type','Subtraction Type']},
  {key:'wordprob', label:'📖 Word Problems & Sets', tags:['Word Problem','Fraction of a Set']},
];

function getTrainerCandidates(){
  // Dynamic trainer candidates: open path tiles away from the edges and start
  const candidates = [];
  const startR = START.row, startC = START.col;
  for(let r=2;r<ROWS-2;r++){
    for(let c=2;c<COLS-2;c++){
      if(MAP[r][c] === '.' && Math.abs(r-startR)+Math.abs(c-startC) >= 5){
        candidates.push({row:r, col:c});
      }
    }
  }
  return candidates;
}
let TRAINER_CANDIDATES = getTrainerCandidates();

function regenerateLandscape(){
  MAP_GEN = generateMap();
  MAP = MAP_GEN.map;
  TOTAL_SLOTS = MAP_GEN.slotCount;
  ROWS = MAP.length;
  COLS = MAP[0].length;
  START = {row:Math.floor(MAP_ROWS/2), col:Math.floor(MAP_COLS/2)};
  ensureWalkableStart();
  TRAINER_CANDIDATES = getTrainerCandidates();
}