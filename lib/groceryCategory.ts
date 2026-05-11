export type GroceryCategory =
  | 'produce'
  | 'meat'
  | 'dairy'
  | 'pantry'
  | 'spices'
  | 'bakery'
  | 'frozen'
  | 'drinks'
  | 'other';

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  'produce',
  'meat',
  'dairy',
  'pantry',
  'spices',
  'bakery',
  'frozen',
  'drinks',
  'other',
];

export const GROCERY_CATEGORY_LABEL: Record<GroceryCategory, string> = {
  produce: 'Produce',
  meat: 'Meat & Seafood',
  dairy: 'Dairy & Eggs',
  pantry: 'Pantry',
  spices: 'Spices',
  bakery: 'Bakery',
  frozen: 'Frozen',
  drinks: 'Drinks',
  other: 'Other',
};

const KEYWORDS: Array<[GroceryCategory, RegExp]> = [
  [
    'produce',
    /\b(apple|avocado|banana|basil|beet|berry|blueberr|broccoli|cabbage|carrot|celery|cherry|chive|cilantro|cucumber|dill|eggplant|fennel|garlic|ginger|grape|green bean|herb|kale|leek|lemon|lettuce|lime|mango|melon|mint|mushroom|onion|orange|parsley|pea|peach|pear|pepper|pineapple|plum|potato|pumpkin|radish|raspberr|rosemary|sage|scallion|shallot|spinach|sprout|squash|strawberr|sweet potato|thyme|tomato|watermelon|zucchini|arugula|chard|romaine|kiwi|grapefruit|nectarine|apricot|pomegranate|fig|cauliflower|asparagus|artichoke|brussels)\b/i,
  ],
  [
    'meat',
    /\b(anchov|bacon|beef|chicken|chorizo|clam|cod|crab|duck|fish|ham|halibut|lamb|lobster|mussel|octopus|oyster|pancetta|pork|prawn|prosciutto|salmon|sausage|scallop|shrimp|squid|steak|tilapia|trout|tuna|turkey|veal|venison|brisket|ribs)\b/i,
  ],
  [
    'dairy',
    /\b(butter|buttermilk|cheese|cream|crème|creme|egg|eggs|feta|ghee|greek yogurt|half[-\s]?and[-\s]?half|kefir|mascarpone|milk|mozzarella|parmesan|ricotta|sour cream|yogurt|cheddar|brie|burrata|gruyere|gouda|cream cheese|cottage cheese)\b/i,
  ],
  [
    'bakery',
    /\b(bagel|baguette|brioche|bread|bun|croissant|pita|roll|tortilla|naan|focaccia|sourdough|english muffin|pretzel)\b/i,
  ],
  [
    'frozen',
    /\b(frozen|ice cream|sorbet|gelato|popsicle|frozen peas|frozen corn)\b/i,
  ],
  [
    'drinks',
    /\b(beer|wine|juice|soda|coffee|tea|sparkling water|kombucha|cocktail|cider|espresso|champagne)\b/i,
  ],
  [
    'spices',
    /\b(salt|pepper|paprika|cumin|coriander|turmeric|cinnamon|nutmeg|clove|cardamom|saffron|chili powder|chilli powder|cayenne|oregano|bay leaf|allspice|garam masala|curry powder|red pepper flakes|smoked paprika|five spice|za'?atar|sumac|fennel seed|mustard seed|caraway|peppercorn|sea salt|kosher salt|vanilla extract|vanilla bean)\b/i,
  ],
  [
    'pantry',
    /\b(flour|sugar|salt|oil|olive oil|vinegar|rice|pasta|noodle|bean|lentil|chickpea|quinoa|oat|cereal|honey|maple syrup|soy sauce|fish sauce|hot sauce|tomato paste|tomato sauce|canned|broth|stock|baking powder|baking soda|cornstarch|cocoa|chocolate|nut|almond|cashew|walnut|peanut|pecan|hazelnut|pistachio|seed|sesame|tahini|miso|mustard|mayonnaise|mayo|ketchup|panko|breadcrumb|gelatin|yeast|coconut milk|condensed milk|evaporated milk|jam|jelly|peanut butter|nutella|stock cube|bouillon|wonton|tofu|tempeh|seitan|raisin|cranberr|dried|granola)\b/i,
  ],
];

export function inferGroceryCategory(name: string): GroceryCategory {
  const n = name.toLowerCase();
  if (!n.trim()) return 'other';
  for (const [cat, re] of KEYWORDS) {
    if (re.test(n)) return cat;
  }
  return 'other';
}
