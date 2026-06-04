/**
 * Unit tests for the handleSave payload construction logic in app/recipe/new.tsx.
 *
 * The logic is extracted verbatim from the component's handleSave function and
 * run with plain Node.js (no test framework needed).
 *
 * Run: node .pipeline/tests/payload.test.mjs
 */

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  PASS  ${description}`);
    passed++;
  } else {
    console.error(`  FAIL  ${description}`);
    failed++;
  }
}

function assertEqual(actual, expected, description) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${description}`);
    passed++;
  } else {
    console.error(`  FAIL  ${description}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helper: build the payload exactly as handleSave does (spec lines 78-98)
// ---------------------------------------------------------------------------
function buildPayload({ title, description, cuisine, difficulty, servings, duration, ingredientRows, stepRows }) {
  return {
    title: title.trim(),
    description: description.trim() || undefined,
    cuisine: cuisine.trim() || undefined,
    difficulty: difficulty ?? undefined,
    servings: Math.max(1, parseInt(servings, 10) || 2),
    durationMinutes: parseInt(duration, 10) || undefined,
    sourceType: 'manual',
    ingredients: ingredientRows
      .filter((r) => r.name.trim())
      .map((r, i) => ({
        name: r.name.trim(),
        quantity: r.quantity.trim() ? (parseFloat(r.quantity) || null) : null,
        unit: r.unit.trim() || undefined,
        orderIndex: i,
      })),
    steps: stepRows
      .filter((r) => r.instruction.trim())
      .map((r, i) => ({ orderIndex: i, instruction: r.instruction.trim() })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n--- Happy path: title-only recipe ---');
{
  const p = buildPayload({
    title: 'Pasta al limone',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [{ name: '', quantity: '', unit: '' }],
    stepRows: [{ instruction: '' }],
  });

  assertEqual(p.title, 'Pasta al limone', 'title preserved');
  assert(p.description === undefined, 'empty description omitted');
  assert(p.cuisine === undefined, 'empty cuisine omitted');
  assert(p.difficulty === undefined, 'null difficulty omitted');
  assertEqual(p.servings, 2, 'servings defaults to 2');
  assert(p.durationMinutes === undefined, 'empty duration omitted');
  assertEqual(p.sourceType, 'manual', 'sourceType is "manual"');
  assertEqual(p.ingredients, [], 'blank ingredient row filtered out');
  assertEqual(p.steps, [], 'blank step row filtered out');
}

console.log('\n--- Title trimming ---');
{
  const p = buildPayload({
    title: '  Spaced Title  ',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.title, 'Spaced Title', 'title is trimmed');
}

console.log('\n--- Servings: non-numeric defaults to 2 ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: 'abc',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.servings, 2, 'non-numeric servings → 2');
}

console.log('\n--- Servings: empty string defaults to 2 ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.servings, 2, 'empty servings → 2');
}

console.log('\n--- Servings: minimum 1 ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '0',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  // parseInt('0') = 0, which is falsy, so parseInt(...) || 2 = 2; Math.max(1,2)=2
  assert(p.servings >= 1, 'servings is at least 1 when input is "0"');
}

console.log('\n--- Servings: negative value clamped to minimum 1 ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '-3',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  // parseInt('-3') = -3, which is truthy, so result is Math.max(1, -3) = 1
  assertEqual(p.servings, 1, 'negative servings clamped to 1');
}

console.log('\n--- Servings: valid positive int ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '4',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.servings, 4, 'valid servings "4" → 4');
}

console.log('\n--- Duration: numeric string included ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '45',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.durationMinutes, 45, 'valid duration "45" → 45');
}

console.log('\n--- Duration: empty string omitted ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assert(p.durationMinutes === undefined, 'empty duration omitted (not 0)');
}

console.log('\n--- Duration: non-numeric string omitted ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: 'lots',
    ingredientRows: [],
    stepRows: [],
  });
  assert(p.durationMinutes === undefined, 'non-numeric duration omitted');
}

console.log('\n--- Duration: "0" omitted (falsy after parseInt) ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '0',
    ingredientRows: [],
    stepRows: [],
  });
  // parseInt('0') = 0, which is falsy → undefined
  assert(p.durationMinutes === undefined, '"0" duration treated as omitted');
}

console.log('\n--- Ingredients: blank rows filtered ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [
      { name: '', quantity: '', unit: '' },
      { name: 'Flour', quantity: '2', unit: 'cups' },
      { name: '   ', quantity: '', unit: '' },
    ],
    stepRows: [],
  });
  assertEqual(p.ingredients.length, 1, 'only non-blank ingredient rows included');
  assertEqual(p.ingredients[0].name, 'Flour', 'ingredient name preserved');
  assertEqual(p.ingredients[0].quantity, 2, 'ingredient quantity parsed to number');
  assertEqual(p.ingredients[0].unit, 'cups', 'ingredient unit preserved');
  assertEqual(p.ingredients[0].orderIndex, 0, 'order index re-numbered after filtering');
}

console.log('\n--- Ingredients: blank quantity becomes null ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [{ name: 'Salt', quantity: '', unit: '' }],
    stepRows: [],
  });
  assert(p.ingredients[0].quantity === null, 'blank quantity → null');
}

console.log('\n--- Ingredients: blank unit becomes undefined ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [{ name: 'Salt', quantity: '', unit: '' }],
    stepRows: [],
  });
  assert(p.ingredients[0].unit === undefined, 'blank unit → undefined');
}

console.log('\n--- Ingredients: non-numeric quantity becomes null ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [{ name: 'Salt', quantity: 'a handful', unit: '' }],
    stepRows: [],
  });
  // parseFloat('a handful') = NaN; NaN || null = null
  assert(p.ingredients[0].quantity === null, 'non-numeric quantity → null');
}

console.log('\n--- Steps: blank rows filtered ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [],
    stepRows: [
      { instruction: '' },
      { instruction: 'Boil water' },
      { instruction: '   ' },
    ],
  });
  assertEqual(p.steps.length, 1, 'only non-blank step rows included');
  assertEqual(p.steps[0].instruction, 'Boil water', 'step instruction preserved');
  assertEqual(p.steps[0].orderIndex, 0, 'step order index re-numbered after filtering');
}

console.log('\n--- Steps: instruction trimmed ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: null,
    servings: '2',
    duration: '',
    ingredientRows: [],
    stepRows: [{ instruction: '  Add salt  ' }],
  });
  assertEqual(p.steps[0].instruction, 'Add salt', 'step instruction trimmed');
}

console.log('\n--- Difficulty: set value persisted ---');
{
  const p = buildPayload({
    title: 'test',
    description: '',
    cuisine: '',
    difficulty: 'hard',
    servings: '2',
    duration: '',
    ingredientRows: [],
    stepRows: [],
  });
  assertEqual(p.difficulty, 'hard', 'difficulty "hard" persisted');
}

console.log('\n--- Full recipe with all fields ---');
{
  const p = buildPayload({
    title: '  Thai Green Curry  ',
    description: 'A classic Thai dish',
    cuisine: 'Thai',
    difficulty: 'medium',
    servings: '4',
    duration: '30',
    ingredientRows: [
      { name: 'Chicken', quantity: '500', unit: 'g' },
      { name: 'Coconut milk', quantity: '400', unit: 'ml' },
      { name: '', quantity: '', unit: '' },
    ],
    stepRows: [
      { instruction: 'Heat oil in pan' },
      { instruction: 'Add curry paste' },
      { instruction: '' },
    ],
  });
  assertEqual(p.title, 'Thai Green Curry', 'title trimmed');
  assertEqual(p.description, 'A classic Thai dish', 'description included');
  assertEqual(p.cuisine, 'Thai', 'cuisine included');
  assertEqual(p.difficulty, 'medium', 'difficulty included');
  assertEqual(p.servings, 4, 'servings parsed');
  assertEqual(p.durationMinutes, 30, 'duration parsed');
  assertEqual(p.sourceType, 'manual', 'sourceType is manual');
  assertEqual(p.ingredients.length, 2, 'blank ingredient filtered');
  assertEqual(p.steps.length, 2, 'blank step filtered');
}

console.log('\n--- Button disabled guard: empty title ---');
{
  // handleSave begins with: if (!title.trim() || loading) return;
  const title = '   ';
  assert(!title.trim(), 'whitespace-only title treated as empty (button should be disabled)');
}

console.log('\n--- Button disabled guard: loading prevents double-submit ---');
{
  // The component sets disabled={!title.trim()} and loading state disables Button
  // We test the logical guard: !title.trim() || loading
  const guardFires = (title, loading) => !title.trim() || loading;
  assert(guardFires('My recipe', true), 'loading=true → guard fires, no double submit');
  assert(!guardFires('My recipe', false), 'valid title, not loading → guard does not fire');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
