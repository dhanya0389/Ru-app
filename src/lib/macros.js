// Server-side macro calculation via USDA FoodData Central.
//
// LLMs hallucinate macro values badly — we saw 34g protein on a meal that
// actually contains 67g. This module replaces the AI's guess with real
// nutrition data:
//   1. Parse each ingredient string (quantity + unit + name)
//   2. Search USDA FoodData Central for the food item
//   3. Multiply nutrient-per-100g by parsed quantity in grams
//   4. Sum across all ingredients
//
// Free public API key required (USDA_API_KEY env var).

const USDA_API = 'https://api.nal.usda.gov/fdc/v1/foods/search'

// USDA nutrient IDs we care about. Calories appear under different IDs
// depending on dataset: SR Legacy uses 1008, Foundation uses 2047 (Atwater
// General) or 2048 (Atwater Specific). We check all three.
const NUTRIENT = { protein: 1003, fat: 1004, carbs: 1005 }
const CALORIE_IDS = [1008, 2047, 2048]

// Canonical USDA-derived nutrition values for the top home-cooking staples.
// Values per 100g, sourced from USDA FoodData Central (SR Legacy + Foundation).
// Hardcoding these bypasses the search layer for the most common ingredients
// where USDA search consistently picked wrong matches (egg → egg white,
// brown rice → rice flour, chicken breast → deli roll, etc.). Search is
// still used for everything not in this list.
//
// Match order matters: more-specific keys checked first. "chicken breast"
// must beat "chicken"; "greek yogurt" must beat "yogurt". The lookup walks
// this array top to bottom and uses substring matching on the parsed
// ingredient name (after parseIngredient strips quantities + prep modifiers).
function vals(cal, p, c, f) {
  return { caloriesPer100g: cal, proteinPer100g: p, carbsPer100g: c, fatPer100g: f }
}
const CANONICAL_FOODS = [
  // ── Animal proteins ──────────────────────────────────────────────
  { match: ['mahi mahi', 'mahimahi'], ...vals(109, 24, 0, 1), label: 'Fish, mahi mahi, raw' },
  { match: ['salmon'], ...vals(208, 22, 0, 13), label: 'Fish, salmon, cooked' },
  { match: ['tuna'], ...vals(184, 30, 0, 6), label: 'Fish, tuna, cooked' },
  { match: ['cod'], ...vals(105, 22, 0, 0.9), label: 'Fish, cod, cooked' },
  { match: ['halibut'], ...vals(140, 27, 0, 2.9), label: 'Fish, halibut, cooked' },
  { match: ['trout'], ...vals(168, 24, 0, 7.5), label: 'Fish, trout, cooked' },
  { match: ['sardine'], ...vals(208, 25, 0, 11), label: 'Fish, sardines, canned in oil' },
  { match: ['pollock'], ...vals(118, 24, 0, 1.5), label: 'Fish, pollock, cooked' },
  { match: ['tilapia'], ...vals(128, 26, 0, 2.7), label: 'Fish, tilapia, cooked' },
  { match: ['haddock'], ...vals(110, 25, 0, 0.9), label: 'Fish, haddock, cooked' },
  { match: ['mackerel'], ...vals(305, 19, 0, 25), label: 'Fish, mackerel, cooked' },
  { match: ['sea bass'], ...vals(124, 24, 0, 2.6), label: 'Fish, sea bass, cooked' },
  { match: ['snapper'], ...vals(125, 26, 0, 1.7), label: 'Fish, snapper, cooked' },
  { match: ['shrimp', 'prawn'], ...vals(99, 24, 0, 0.3), label: 'Shrimp, cooked' },
  { match: ['scallop'], ...vals(112, 24, 5, 0.8), label: 'Scallops, cooked' },
  { match: ['chicken breast'], ...vals(165, 31, 0, 3.6), label: 'Chicken breast, skinless, cooked' },
  { match: ['chicken thigh'], ...vals(209, 26, 0, 11), label: 'Chicken thigh, cooked' },
  { match: ['rotisserie chicken'], ...vals(190, 29, 0, 7.4), label: 'Rotisserie chicken' },
  { match: ['chicken'], ...vals(190, 29, 0, 7.4), label: 'Chicken, cooked, average' },
  { match: ['turkey breast'], ...vals(135, 30, 0, 1), label: 'Turkey breast, cooked' },
  { match: ['ground turkey'], ...vals(149, 27, 0, 3.6), label: 'Ground turkey, 93% lean, cooked' },
  { match: ['turkey'], ...vals(189, 29, 0, 7), label: 'Turkey, cooked' },
  { match: ['ground beef'], ...vals(254, 26, 0, 15), label: 'Ground beef, 85% lean, cooked' },
  { match: ['beef'], ...vals(250, 26, 0, 15), label: 'Beef, cooked, lean' },
  { match: ['lamb'], ...vals(254, 25, 0, 16), label: 'Lamb, cooked' },
  // Eggs — pinned BEFORE generic "egg" so whole-egg query never falls into
  // egg-white or egg-yolk by mistake. Also covers the "2 large eggs" case
  // where parseIngredient strips down to name="eggs".
  { match: ['egg whites', 'egg white'], ...vals(52, 11, 0.7, 0.2), label: 'Egg white, raw' },
  { match: ['egg yolks', 'egg yolk'], ...vals(322, 16, 3.6, 27), label: 'Egg yolk, raw' },
  { match: ['eggs', 'egg'], ...vals(143, 12.6, 0.7, 9.5), label: 'Egg, whole, raw' },
  // ── Dairy ────────────────────────────────────────────────────────
  // Default to whole-milk Greek yogurt — closest to what most home cooks
  // actually buy. The previous USDA search picked nonfat consistently,
  // under-counting fat + calories.
  { match: ['greek yogurt'], ...vals(97, 9, 4, 5), label: 'Greek yogurt, plain, whole milk' },
  { match: ['yogurt'], ...vals(63, 5.2, 7, 1.6), label: 'Yogurt, plain, low-fat' },
  { match: ['cottage cheese'], ...vals(98, 11, 3.4, 4.3), label: 'Cottage cheese, lowfat' },
  { match: ['paneer'], ...vals(296, 18.9, 1.2, 25), label: 'Paneer' },
  { match: ['kefir'], ...vals(50, 3.3, 4.5, 1), label: 'Kefir, lowfat' },
  { match: ['ricotta'], ...vals(174, 11, 3, 13), label: 'Ricotta cheese, whole milk' },
  { match: ['feta'], ...vals(264, 14, 4, 21), label: 'Feta cheese' },
  { match: ['mozzarella'], ...vals(280, 28, 2.2, 17), label: 'Mozzarella, low-moisture, part-skim' },
  { match: ['parmesan'], ...vals(420, 38, 4, 28), label: 'Parmesan, grated' },
  { match: ['cheddar'], ...vals(404, 23, 3.4, 33), label: 'Cheddar cheese' },
  { match: ['halloumi'], ...vals(316, 22, 0, 25), label: 'Halloumi cheese' },
  { match: ['goat cheese'], ...vals(364, 22, 2.5, 30), label: 'Goat cheese, soft' },
  { match: ['cream cheese'], ...vals(342, 6, 4, 34), label: 'Cream cheese' },
  { match: ['heavy cream'], ...vals(340, 2.8, 2.8, 36), label: 'Heavy cream' },
  // Plant milks — pinned BEFORE generic "milk" so "almond milk" doesn't
  // fall into dairy.
  { match: ['almond milk'], ...vals(15, 0.6, 1.5, 1.1), label: 'Almond milk, unsweetened' },
  { match: ['oat milk'], ...vals(43, 1, 6.7, 1.5), label: 'Oat milk' },
  { match: ['soy milk'], ...vals(43, 3.3, 1.8, 1.8), label: 'Soy milk, unsweetened' },
  { match: ['coconut milk'], ...vals(230, 2.3, 6, 24), label: 'Coconut milk, canned' },
  { match: ['milk'], ...vals(50, 3.4, 4.8, 2), label: 'Milk, 2%' },
  // ── Plant proteins ───────────────────────────────────────────────
  { match: ['firm tofu', 'extra firm tofu'], ...vals(144, 17.3, 2.8, 8.7), label: 'Tofu, firm, prepared with calcium sulfate' },
  { match: ['silken tofu'], ...vals(55, 4.8, 2.3, 2.7), label: 'Tofu, silken' },
  { match: ['tofu'], ...vals(144, 17.3, 2.8, 8.7), label: 'Tofu, firm' },
  { match: ['tempeh'], ...vals(192, 20, 8, 11), label: 'Tempeh' },
  { match: ['seitan'], ...vals(370, 75, 14, 1.9), label: 'Seitan' },
  // Cooked legumes — values are for COOKED weight (which is what user typically
  // writes "100g cooked lentils"). Dry weight values are 3x higher.
  { match: ['cooked lentils', 'red lentil', 'lentils'], ...vals(116, 9, 20, 0.4), label: 'Lentils, cooked' },
  { match: ['cooked chickpeas', 'chickpeas', 'garbanzo'], ...vals(164, 9, 27, 2.6), label: 'Chickpeas, cooked' },
  { match: ['black beans'], ...vals(132, 9, 24, 0.5), label: 'Black beans, cooked' },
  { match: ['kidney beans'], ...vals(127, 9, 22, 0.5), label: 'Kidney beans, cooked' },
  { match: ['white beans', 'cannellini', 'navy beans'], ...vals(139, 9.7, 25, 0.4), label: 'White beans, cooked' },
  { match: ['edamame'], ...vals(122, 11, 9, 5), label: 'Edamame, cooked' },
  { match: ['hemp seeds'], ...vals(553, 32, 9, 49), label: 'Hemp seeds, hulled' },
  // ── Grains / starches ────────────────────────────────────────────
  { match: ['cooked brown rice', 'brown rice'], ...vals(112, 2.6, 23, 0.9), label: 'Rice, brown, long-grain, cooked' },
  { match: ['cooked white rice', 'white rice', 'basmati', 'jasmine rice'], ...vals(130, 2.7, 28, 0.3), label: 'Rice, white, cooked' },
  { match: ['rice'], ...vals(130, 2.7, 28, 0.3), label: 'Rice, cooked' },
  { match: ['quinoa'], ...vals(120, 4.4, 21, 1.9), label: 'Quinoa, cooked' },
  { match: ['cooked oats', 'oatmeal'], ...vals(71, 2.5, 12, 1.5), label: 'Oats, cooked' },
  { match: ['oats', 'rolled oats'], ...vals(389, 17, 66, 7), label: 'Oats, dry' },
  { match: ['farro'], ...vals(155, 5.5, 33, 0.9), label: 'Farro, cooked' },
  { match: ['barley'], ...vals(123, 2.3, 28, 0.4), label: 'Barley, cooked' },
  { match: ['buckwheat'], ...vals(92, 3.4, 20, 0.6), label: 'Buckwheat groats, cooked' },
  { match: ['couscous'], ...vals(112, 3.8, 23, 0.2), label: 'Couscous, cooked' },
  { match: ['bulgur'], ...vals(83, 3.1, 19, 0.2), label: 'Bulgur, cooked' },
  { match: ['sweet potato'], ...vals(90, 2, 21, 0.2), label: 'Sweet potato, baked' },
  { match: ['potato'], ...vals(87, 2, 20, 0.1), label: 'Potato, baked' },
  // Bread — sourdough is the most common Ruhi-spec bread; pin it specifically
  // so the SR Legacy "Bread, French or Vienna" entry doesn't get picked.
  { match: ['sourdough'], ...vals(250, 8, 47, 1.9), label: 'Bread, sourdough' },
  { match: ['whole wheat bread', 'whole grain bread'], ...vals(247, 13, 41, 3.4), label: 'Bread, whole wheat' },
  { match: ['rye bread'], ...vals(259, 8.5, 48, 3.3), label: 'Bread, rye' },
  { match: ['bread'], ...vals(265, 9, 49, 3.2), label: 'Bread, white' },
  { match: ['tortilla'], ...vals(218, 5.7, 36, 5.6), label: 'Tortilla, flour' },
  { match: ['pita'], ...vals(275, 9, 55, 1.2), label: 'Pita bread, white' },
  // ── Vegetables ───────────────────────────────────────────────────
  { match: ['spinach'], ...vals(23, 2.9, 3.6, 0.4), label: 'Spinach, raw' },
  { match: ['kale'], ...vals(35, 2.9, 4.4, 1.5), label: 'Kale, raw' },
  { match: ['arugula'], ...vals(25, 2.6, 3.7, 0.7), label: 'Arugula' },
  { match: ['lettuce'], ...vals(15, 1.4, 2.9, 0.2), label: 'Lettuce, romaine' },
  { match: ['broccoli'], ...vals(35, 2.4, 7, 0.4), label: 'Broccoli, cooked' },
  { match: ['cauliflower'], ...vals(23, 1.8, 4.1, 0.4), label: 'Cauliflower, cooked' },
  { match: ['brussels sprouts'], ...vals(36, 2.6, 7, 0.5), label: 'Brussels sprouts, cooked' },
  { match: ['zucchini'], ...vals(17, 1.2, 3.1, 0.3), label: 'Zucchini, raw' },
  { match: ['cucumber'], ...vals(15, 0.7, 3.6, 0.1), label: 'Cucumber, raw' },
  { match: ['bell pepper', 'red pepper', 'green pepper'], ...vals(31, 1, 6, 0.3), label: 'Bell pepper, raw' },
  { match: ['cherry tomatoes', 'tomatoes', 'tomato'], ...vals(18, 0.9, 3.9, 0.2), label: 'Tomato, raw' },
  { match: ['onion'], ...vals(40, 1.1, 9.3, 0.1), label: 'Onion, raw' },
  { match: ['carrot'], ...vals(41, 0.9, 10, 0.2), label: 'Carrot, raw' },
  { match: ['mushroom'], ...vals(22, 3.1, 3.3, 0.3), label: 'Mushroom, white, raw' },
  { match: ['eggplant'], ...vals(25, 1, 6, 0.2), label: 'Eggplant, raw' },
  { match: ['asparagus'], ...vals(20, 2.2, 3.9, 0.1), label: 'Asparagus, raw' },
  { match: ['green beans'], ...vals(31, 1.8, 7, 0.2), label: 'Green beans, cooked' },
  { match: ['peas'], ...vals(81, 5.4, 14, 0.4), label: 'Peas, cooked' },
  { match: ['beets'], ...vals(43, 1.6, 10, 0.2), label: 'Beets, cooked' },
  { match: ['celery'], ...vals(16, 0.7, 3, 0.2), label: 'Celery, raw' },
  // ── Fats ─────────────────────────────────────────────────────────
  // Olive oil — pin to canonical pure olive oil, never "extra light"
  // (the Foundation entry for "extra light" is missing fat data).
  { match: ['olive oil'], ...vals(884, 0, 0, 100), label: 'Oil, olive' },
  { match: ['avocado oil'], ...vals(884, 0, 0, 100), label: 'Oil, avocado' },
  { match: ['coconut oil'], ...vals(862, 0, 0, 100), label: 'Oil, coconut' },
  { match: ['sesame oil'], ...vals(884, 0, 0, 100), label: 'Oil, sesame' },
  { match: ['avocado'], ...vals(160, 2, 9, 15), label: 'Avocado, raw' },
  { match: ['tahini'], ...vals(595, 17, 21, 53), label: 'Tahini' },
  { match: ['almond butter'], ...vals(614, 21, 19, 56), label: 'Almond butter' },
  { match: ['peanut butter'], ...vals(588, 25, 20, 50), label: 'Peanut butter' },
  { match: ['cashew butter'], ...vals(587, 18, 28, 50), label: 'Cashew butter' },
  { match: ['ghee'], ...vals(900, 0, 0, 100), label: 'Ghee' },
  { match: ['butter'], ...vals(717, 0.9, 0.1, 81), label: 'Butter' },
  { match: ['almonds'], ...vals(579, 21, 22, 50), label: 'Almonds' },
  { match: ['walnuts'], ...vals(654, 15, 14, 65), label: 'Walnuts' },
  { match: ['cashews'], ...vals(553, 18, 30, 44), label: 'Cashews' },
  { match: ['pumpkin seeds', 'pepitas'], ...vals(559, 30, 11, 49), label: 'Pumpkin seeds' },
  { match: ['sunflower seeds'], ...vals(584, 21, 20, 51), label: 'Sunflower seeds' },
  { match: ['flax seeds', 'flaxseed'], ...vals(534, 18, 29, 42), label: 'Flax seeds' },
  { match: ['chia seeds'], ...vals(486, 17, 42, 31), label: 'Chia seeds' },
  { match: ['sesame seeds'], ...vals(573, 18, 23, 50), label: 'Sesame seeds' },
  // ── Fruits ───────────────────────────────────────────────────────
  { match: ['banana'], ...vals(89, 1.1, 23, 0.3), label: 'Banana, raw' },
  { match: ['blueberries'], ...vals(57, 0.7, 14, 0.3), label: 'Blueberries, raw' },
  { match: ['strawberries'], ...vals(32, 0.7, 7.7, 0.3), label: 'Strawberries, raw' },
  { match: ['raspberries'], ...vals(52, 1.2, 12, 0.7), label: 'Raspberries, raw' },
  { match: ['blackberries'], ...vals(43, 1.4, 10, 0.5), label: 'Blackberries, raw' },
  { match: ['berries'], ...vals(50, 1, 12, 0.4), label: 'Berries, mixed' },
  { match: ['apple'], ...vals(52, 0.3, 14, 0.2), label: 'Apple, raw' },
  { match: ['pear'], ...vals(57, 0.4, 15, 0.1), label: 'Pear, raw' },
  { match: ['orange'], ...vals(47, 0.9, 12, 0.1), label: 'Orange, raw' },
  { match: ['mango'], ...vals(60, 0.8, 15, 0.4), label: 'Mango, raw' },
  { match: ['pineapple'], ...vals(50, 0.5, 13, 0.1), label: 'Pineapple, raw' },
  { match: ['grapes'], ...vals(69, 0.7, 18, 0.2), label: 'Grapes, raw' },
  // ── Condiments / sauces ──────────────────────────────────────────
  { match: ['hummus'], ...vals(166, 7.9, 14, 9.6), label: 'Hummus' },
  { match: ['salsa'], ...vals(36, 1.5, 7, 0.2), label: 'Salsa' },
  { match: ['soy sauce', 'tamari'], ...vals(53, 8, 5, 0.6), label: 'Soy sauce' },
  { match: ['miso'], ...vals(199, 12, 26, 6), label: 'Miso paste' },
  { match: ['vinegar'], ...vals(20, 0, 0.9, 0), label: 'Vinegar' },
  { match: ['honey'], ...vals(304, 0.3, 82, 0), label: 'Honey' },
  { match: ['maple syrup'], ...vals(260, 0, 67, 0.1), label: 'Maple syrup' },
  // ── Drinks / wellness ────────────────────────────────────────────
  { match: ['bone broth', 'chicken broth', 'vegetable broth', 'broth', 'stock'], ...vals(15, 2, 0.7, 0.5), label: 'Broth' },
  { match: ['matcha'], ...vals(280, 30, 39, 5), label: 'Matcha powder' },
  // ── Spices (trivial macros, shown for completeness) ──────────────
  { match: ['turmeric'], ...vals(312, 9.7, 67, 3.3), label: 'Spices, turmeric, ground' },
  { match: ['cumin'], ...vals(375, 18, 44, 22), label: 'Spices, cumin seed' },
  { match: ['ginger'], ...vals(80, 1.8, 18, 0.8), label: 'Ginger root, raw' },
  { match: ['garlic'], ...vals(149, 6.4, 33, 0.5), label: 'Garlic, raw' },
]

function lookupCanonical(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  for (const food of CANONICAL_FOODS) {
    for (const key of food.match) {
      if (lower.includes(key)) {
        return {
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          caloriesPer100g: food.caloriesPer100g,
          matchedAs: food.label,
          matchedVia: 'canonical',
        }
      }
    }
  }
  return null
}

// Average weights for common "1 medium X" / "1 large X" items where the
// user input is a count rather than a weight. Conservative best-guesses.
const COUNT_WEIGHTS_G = {
  egg: 50,            // large egg
  'chicken breast': 170,  // 1 medium boneless skinless
  'salmon fillet': 170,
  'sweet potato': 200,    // 1 medium
  potato: 170,            // 1 medium
  onion: 150,             // 1 medium
  tomato: 120,
  garlic: 5,              // 1 clove
  lemon: 60,
  lime: 50,
  apple: 180,
  banana: 120,
  avocado: 200,
  cucumber: 200,
  carrot: 60,             // 1 medium
}

// Volume to grams conversion (rough — varies by ingredient density).
// For dry ingredients we lean on item-specific tables when needed.
const VOLUME_TO_G = {
  cup: 240,    // 1 cup ~= 240ml liquid; for dry/grain we approximate
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  ml: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
}

const WEIGHT_TO_G = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
}

// Parse "1 ½ cups cooked lentils" / "150g salmon" / "3 large eggs" / "salt to taste"
// Returns { quantity, unit, name, weightHint } or null if unparseable.
// `weightHint` (in grams) is set when the ingredient string has a parenthetical
// weight cue like "(~55g)" or "(about 100g)" — used as the authoritative gram
// count when present, since recipes often spell it out for ambiguous units
// like "1 slice" or "½ avocado".
export function parseIngredient(str) {
  if (!str) return null
  let s = str.trim().toLowerCase()
  // Pull out a parenthetical weight hint BEFORE stripping parens. Patterns:
  //   "(~55g)"  "(about 100g)"  "(roughly 45 g)"  "(50g)"  "(½ fruit, 100g)"
  // We accept the first weight match found.
  let weightHint = null
  const parenWeightRe = /\(([^)]*?)(\d+(?:\.\d+)?)\s*g\b[^)]*?\)/
  const wmatch = s.match(parenWeightRe)
  if (wmatch) {
    const grams = parseFloat(wmatch[2])
    if (Number.isFinite(grams) && grams > 0 && grams < 5000) {
      weightHint = grams
    }
  }
  // Now strip parenthetical notes: "1 can (400ml) chickpeas" → "1 can chickpeas"
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

  // Number (incl. fractions like "1/2", "½", "1 1/2")
  const numRe = /^(\d+(?:\s\d+)?\/?\d*|[½⅓⅔¼¾⅛⅜⅝⅞]+)/
  const numMatch = s.match(numRe)
  if (!numMatch) {
    // No quantity — likely "salt to taste" or similar
    return { quantity: 0, unit: null, name: s, contributesMacros: false }
  }
  const quantity = parseFraction(numMatch[1])
  s = s.slice(numMatch[0].length).trim()

  // Unit (optional). 'slice|slices' added so "1 slice sourdough" resolves
  // (previously dropped to null → skipped entirely).
  const unitRe = /^(g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|l|liters?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|small|medium|large|whole|fillet|breast|slice|slices|clove|cloves|piece|pieces|can|cans|jar|jars|bunch|bunches|bottle|sprig|sprigs|knob|pinch|handful|handfuls|stalk|stalks)\b\.?\s*/
  const unitMatch = s.match(unitRe)
  let unit = null
  if (unitMatch) {
    unit = unitMatch[1]
    s = s.slice(unitMatch[0].length).trim()
  }
  // Strip leading "of" ("1 cup of rice")
  s = s.replace(/^of\s+/, '').trim()
  // Strip everything from the FIRST comma onward — comma in an ingredient
  // string almost always signals prep notes ("chicken breast, thinly sliced",
  // "tomato, chopped"). Keeping just the first clause gives USDA a clean
  // food-name to match against.
  s = s.split(',')[0].trim()
  // Strip remaining single-word prep modifiers if they're trailing.
  s = s.replace(/\s+(chopped|diced|sliced|minced|grated|drained|rinsed|cooked|raw|fresh|dried|peeled|cubed|crushed|whole|finely|roughly|pitted|halved|toasted|wilted|steamed|grilled|baked|seared)\s*$/, '').trim()
  return { quantity, unit, name: s, contributesMacros: true, weightHint }
}

function parseFraction(str) {
  const unicodeFractions = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
  if (unicodeFractions[str]) return unicodeFractions[str]
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const fr = str.match(/^(\d+)\/(\d+)$/)
  if (fr) return parseInt(fr[1]) / parseInt(fr[2])
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// Convert (quantity, unit, name) → grams. Returns null when we can't.
// `weightHint` (from parseIngredient) overrides everything when present —
// e.g. "1 slice sourdough (~55g)" uses 55g directly, since the recipe
// author's stated weight is more accurate than any unit guess.
function toGrams(quantity, unit, name, weightHint) {
  if (weightHint != null && weightHint > 0) return weightHint
  if (!quantity) return 0
  if (!unit) {
    // No unit — treat as a count of items if we know the avg weight
    const w = matchCountWeight(name)
    return w ? quantity * w : null
  }
  if (WEIGHT_TO_G[unit]) return quantity * WEIGHT_TO_G[unit]
  if (VOLUME_TO_G[unit]) return quantity * VOLUME_TO_G[unit]
  // size descriptors with implicit count: "1 medium onion", "3 large eggs"
  if (['small', 'medium', 'large', 'whole', 'fillet', 'breast', 'piece', 'pieces'].includes(unit)) {
    const w = matchCountWeight(name)
    return w ? quantity * w : null
  }
  // "1 slice sourdough" — bread default 30g; cheese ~20g; meat slice ~25g.
  // Without a weightHint, assume bread since that's by far the most common
  // "slice" in cooking context.
  if (unit === 'slice' || unit === 'slices') {
    const lower = name.toLowerCase()
    if (lower.includes('bread') || lower.includes('sourdough') || lower.includes('toast') || lower.includes('rye') || lower.includes('whole wheat')) {
      return quantity * 30
    }
    if (lower.includes('cheese')) return quantity * 20
    if (lower.includes('tomato')) return quantity * 20
    if (lower.includes('bacon') || lower.includes('ham') || lower.includes('prosciutto') || lower.includes('turkey') || lower.includes('chicken')) {
      return quantity * 25
    }
    // Unknown slice — best guess ~25g.
    return quantity * 25
  }
  if (unit === 'clove' || unit === 'cloves') return quantity * 5
  if (unit === 'pinch') return quantity * 0.5
  if (unit === 'handful' || unit === 'handfuls') return quantity * 30 // leafy greens
  // Cans — yield depends on what's inside. Drained beans/legumes/tuna are
  // typically ~240g out of a 15oz can; liquids/tomatoes/coconut milk are ~400g.
  // Default to drained (240g) since beans + chickpeas are by far the most
  // common "1 can X" pattern in home cooking.
  if (unit === 'can' || unit === 'cans') {
    const lower = name.toLowerCase()
    // Liquids / sauces / canned tomatoes ship gross weight (~400g for a 15oz
    // can). Drained beans / legumes / tuna / corn ship ~240g after draining.
    // Drop the trailing word-boundary so "tomato" matches "tomatoes" too.
    if (/\b(tomato|coconut milk|broth|stock|soup|pumpkin puree|sauce|salsa)/.test(lower)) {
      return quantity * 400
    }
    return quantity * 240
  }
  if (unit === 'jar' || unit === 'jars') return quantity * 200
  if (unit === 'bunch' || unit === 'bunches') return quantity * 60
  if (unit === 'sprig' || unit === 'sprigs') return quantity * 2
  if (unit === 'knob') return quantity * 15
  if (unit === 'stalk' || unit === 'stalks') return quantity * 40 // celery
  return null
}

function matchCountWeight(name) {
  for (const [key, w] of Object.entries(COUNT_WEIGHTS_G)) {
    if (name.includes(key)) return w
  }
  return null
}

// Words in a USDA description that likely indicate a PROCESSED form when the
// user asked for a basic ingredient. Used to reject obvious mismatches:
// "chicken breast" matching "Chicken breast tenders, breaded, uncooked", or
// "fresh spinach" matching "Pasta, fresh-refrigerated, spinach".
const REJECT_IF_PRESENT = [
  'breaded', 'fried', 'fritter', 'pasta', 'pizza', 'soup,', 'sauce,',
  'cookie', 'cake', 'cracker', 'cereal', 'snack', 'bar,', 'mix,',
  'restaurant', 'fast food', 'frozen meal',
]

// Words to STRIP from the search query before sending to USDA — they confuse
// matching since USDA descriptions don't use them (USDA uses "raw" not "fresh").
// Expanded May 4: more prep adjectives so queries like "extra firm tofu" or
// "lightly toasted hemp seeds" reduce to "tofu" / "hemp seeds" — those have
// USDA hits, the modifier-laden phrases don't.
const STRIP_FROM_QUERY = /\b(organic|free.?range|grass.?fed|wild|farmed|low.?sodium|unsweetened|plain|fresh|extra.?firm|firm|silken|soft|hard|raw|cooked|dry|dried|whole|ground|crumbled|crushed|chopped|diced|sliced|minced|grated|toasted|lightly|roughly|finely|freshly|lightly.?toasted|roasted|baked|steamed|boiled|softened|unsalted|salted|frozen|canned|jarred|store.?bought|home.?made|homemade|low.?fat|reduced.?fat|nonfat|non.?fat|full.?fat|skinless|boneless|seedless|pitted|peeled|chilled|warmed|ripe|unripe|small|medium|large)\b/gi

function cleanQuery(name) {
  return name
    .replace(STRIP_FROM_QUERY, '')
    .replace(/\s+/g, ' ')
    .split(/\s+or\s+/)[0]   // "chicken or vegetable broth" → "chicken broth"
    .trim()
}

// Build a list of progressively-broader query variants to try when the
// initial search misses. "extra firm tofu" already gets cleaned to "tofu",
// but compound phrases like "Greek yogurt unsweetened plain" → "Greek yogurt"
// → "yogurt" let us fall back to broader hits.
function queryVariants(name) {
  const cleaned = cleanQuery(name)
  if (!cleaned) return []
  const variants = [cleaned]
  // Drop adjectives one word at a time from the LEFT (cuisine prefixes like
  // "Greek yogurt" → "yogurt"; "smoked salmon" → "salmon")
  const words = cleaned.split(/\s+/).filter(Boolean)
  for (let i = 1; i < words.length; i++) {
    const broader = words.slice(i).join(' ')
    if (broader && !variants.includes(broader)) variants.push(broader)
  }
  // Also try the LAST word alone as a final fallback ("hemp seeds" → "hemp"
  // already covered by the loop above; this handles edge cases).
  return variants
}

// Words that strongly signal a WRONG match — a processed, branded, or
// composite-dish form when the user asked for a base ingredient. The score
// hit is large enough that even a query-word match in the description can't
// out-rank a candidate without these. These are the patterns we saw shipping
// wrong macros: "Egg, Grade A, egg white" matching "eggs" query, "Yogurt,
// Greek, plain, nonfat" matching "Greek yogurt", "Chicken breast, roll" etc.
const HARD_REJECT_WORDS = [
  'white',           // egg white when query is "eggs"
  'yolk',            // egg yolk when query is "eggs"
  'nonfat',          // nonfat dairy when user wrote 2% / full-fat
  'non-fat',
  'low-fat',
  'lowfat',
  'fat-free',
  'fat free',
  'reduced fat',
  'extra light',     // olive oil "extra light" with broken fat data
  'fat reduced',
  'flour',           // rice flour vs cooked rice
  'souffle',         // composite dish
  'roll,',           // deli "chicken breast, roll, oven-roasted"
  'oven-roasted',    // typically signals deli/processed in Foundation set
  'deli',
  'lunch meat',
  'lunchmeat',
  'cold cut',
  'patty',
  'frozen meal',
  'tv dinner',
  'breaded',
  'fried',
  'fritter',
  'nugget',
  'tender',          // "chicken breast tenders, breaded"
  'vegetarian',      // "Vegetarian fillets" matching pollock query
  'vegan',           // same — composite meat substitutes
  'meatless',
  'imitation',
]

// Score a USDA candidate against the original query — higher = better match.
// Replaces the prior "first reasonable match" logic, which sometimes picked
// a mediocre Foundation entry when a much better SR Legacy entry existed.
//
// Scoring rules:
//   +10 if the description starts with the query word (best — exact root)
//   +5  for each query word found in the description
//   -25 for each HARD_REJECT_WORDS hit not in the query (was -8; bumped up
//       after Dhanya's audit found "egg white" ranking above "egg, whole").
//   -3  per extra prep modifier in description ("with sauce", "fried")
//   -2  if it's a branded / commercial form when query is generic
function scoreCandidate(food, query) {
  const desc = (food.description || '').toLowerCase()
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(Boolean)
  let score = 0

  // Exact root start = strong signal. Match singular OR plural — "eggs"
  // query against "Egg, whole, raw, fresh" should still win that +10 even
  // though desc starts with "egg" not "eggs".
  const firstWord = queryWords[0] || ''
  const firstSingular = firstWord.endsWith('s') ? firstWord.slice(0, -1) : firstWord
  if (firstWord && (desc.startsWith(firstWord) || (firstSingular.length > 2 && desc.startsWith(firstSingular)))) {
    score += 10
  }
  // Each query word in description (also try singular form)
  queryWords.forEach((w) => {
    if (w.length > 2) {
      const singular = w.endsWith('s') ? w.slice(0, -1) : w
      if (desc.includes(w) || (singular.length > 2 && desc.includes(singular))) score += 5
    }
  })
  // HARD reject penalties — large enough to overcome the +10/+5 from base
  // matching when the wrong-form word is present and the user didn't ask
  // for it. Word-boundary check so "white" in "egg white" hits but "white"
  // inside "buckwheat" doesn't (rare edge case but safer).
  for (const word of HARD_REJECT_WORDS) {
    if (queryLower.includes(word.replace(',', ''))) continue
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(desc)) score -= 25
  }
  // Soft reject (composite dishes etc.) — kept lighter
  for (const word of REJECT_IF_PRESENT) {
    if (desc.includes(word) && !queryLower.includes(word.replace(',', ''))) {
      score -= 8
    }
  }
  // Extra modifier penalty — ", with X" ", and Y" suggests composite dish
  const modifierCount = (desc.match(/,\s*\w+/g) || []).length
  score -= modifierCount * 1.5
  // Branded foods often have inflated/processed nutrient profiles
  if (food.brandOwner || food.brandName) score -= 2

  return score
}

// Search USDA. Three layers of fallback:
//   1. For each query variant, search Foundation (canonical raw foods)
//   2. For each query variant, search SR Legacy (broader, includes cooked)
//   3. Pick the highest-scoring candidate across all variants + dataTypes
async function searchUSDA(name, apiKey) {
  const variants = queryVariants(name)
  if (variants.length === 0) return null

  async function fetchCandidates(query, dataType) {
    const url = `${USDA_API}?query=${encodeURIComponent(query)}&pageSize=5&dataType=${encodeURIComponent(dataType)}&api_key=${apiKey}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return []
      const data = await res.json()
      return (data.foods || []).map((f) => ({ ...f, _query: query, _dataType: dataType }))
    } catch {
      return []
    }
  }

  // Try the most specific variant first; only broaden if needed. This keeps
  // us from getting bad-but-broad matches when a precise hit was available.
  for (const variant of variants) {
    // For each variant, try Foundation first, then SR Legacy
    const foundation = await fetchCandidates(variant, 'Foundation')
    const srLegacy = await fetchCandidates(variant, 'SR Legacy')
    const candidates = [...foundation, ...srLegacy]
    if (candidates.length === 0) continue

    // Score and pick the best
    const scored = candidates
      .map((c) => ({ food: c, score: scoreCandidate(c, variant) }))
      .sort((a, b) => b.score - a.score)
    const best = scored[0]
    // Only accept if the score is positive — negative means worse than nothing
    if (!best || best.score < 0) continue

    const food = best.food
    const find = (id) => food.foodNutrients?.find(n => n.nutrientId === id)?.value || 0
    const findCalories = () => {
      for (const id of CALORIE_IDS) {
        const v = find(id)
        if (v > 0) return v
      }
      return 0
    }
    return {
      proteinPer100g: find(NUTRIENT.protein),
      carbsPer100g: find(NUTRIENT.carbs),
      fatPer100g: find(NUTRIENT.fat),
      caloriesPer100g: findCalories(),
      matchedAs: food.description,
      matchedVia: `${variant} (${food._dataType})`,
    }
  }
  return null
}

/**
 * Calculate macros for a recipe given its ingredients list.
 * Falls back gracefully when an ingredient can't be parsed or matched.
 *
 * @param {string[]} ingredients
 * @returns {Promise<{protein:number, carbs:number, fat:number, calories:number, debug?:object}>}
 */
export async function calculateMacros(ingredients) {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey || !ingredients?.length) return null

  let totalP = 0, totalC = 0, totalF = 0, totalCal = 0
  const debug = []

  // Run lookups in parallel for speed. Each ingredient:
  //   1. parseIngredient → { quantity, unit, name, weightHint }
  //   2. toGrams (uses weightHint if recipe spelled it out)
  //   3. lookupCanonical FIRST — top home staples have hardcoded USDA values
  //      to bypass the search layer's known mismatches (egg → egg white,
  //      brown rice → rice flour, chicken breast → deli roll).
  //   4. searchUSDA fallback for non-canonical ingredients
  const lookups = await Promise.all(ingredients.map(async (raw) => {
    const parsed = parseIngredient(raw)
    if (!parsed || !parsed.contributesMacros) {
      return { raw, skipped: true, reason: 'no quantity (e.g., salt to taste)' }
    }
    const grams = toGrams(parsed.quantity, parsed.unit, parsed.name, parsed.weightHint)
    if (!grams) {
      return { raw, parsed, skipped: true, reason: 'cannot convert to grams' }
    }
    let nutrients = lookupCanonical(parsed.name)
    if (!nutrients) {
      nutrients = await searchUSDA(parsed.name, apiKey)
    }
    if (!nutrients) {
      return { raw, parsed, grams, skipped: true, reason: 'no canonical or USDA match' }
    }
    const factor = grams / 100
    return {
      raw,
      parsed,
      grams,
      matchedAs: nutrients.matchedAs,
      matchedVia: nutrients.matchedVia,
      protein: nutrients.proteinPer100g * factor,
      carbs: nutrients.carbsPer100g * factor,
      fat: nutrients.fatPer100g * factor,
      calories: nutrients.caloriesPer100g * factor,
    }
  }))

  for (const r of lookups) {
    if (r.skipped) {
      debug.push({ raw: r.raw, skipped: true, reason: r.reason })
      continue
    }
    totalP += r.protein
    totalC += r.carbs
    totalF += r.fat
    totalCal += r.calories
    debug.push({ raw: r.raw, matchedAs: r.matchedAs, grams: Math.round(r.grams), p: Math.round(r.protein), c: Math.round(r.carbs), f: Math.round(r.fat) })
  }

  const result = {
    protein: Math.round(totalP),
    carbs: Math.round(totalC),
    fat: Math.round(totalF),
    calories: Math.round(totalCal),
    debug,
  }

  // Sanity check — if values are implausible for a single meal, return null
  // so the caller falls back to the AI's macro guess. USDA matching can
  // surface wrong items (e.g., dry beans when user said cooked, or processed
  // forms with inflated nutrients) and confidently-wrong is worse than
  // approximately-right.
  if (
    result.calories < 100 || result.calories > 2000 ||
    result.protein < 3   || result.protein > 100 ||
    result.carbs < 0     || result.carbs > 200 ||
    result.fat < 0       || result.fat > 100
  ) {
    return null
  }
  return result
}

/**
 * Format calculated macros as the macro display string used in cards.
 * @returns string like "32g protein · 45g carbs · 18g fat"
 */
export function formatMacros(macros) {
  if (!macros) return null
  return `${macros.protein}g protein · ${macros.carbs}g carbs · ${macros.fat}g fat`
}

export function formatCalories(macros) {
  if (!macros) return null
  return `~${macros.calories} cal`
}
