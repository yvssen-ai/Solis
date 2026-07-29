/**
 * Solis menu.
 *
 * All prices are in Egyptian Pounds (L.E). `price` is a plain number so it can be
 * formatted, sorted or filtered; the UI adds the currency label.
 *
 * To edit the menu, this is the only file you need to touch — every section of the
 * site (category rail, counts, highlights) is derived from this array.
 */

export const CURRENCY = 'E£';

export const menu = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    tagline: 'Served from open until noon',
    note: 'Eggs cracked to order, on bread we laminated the same morning.',
    items: [
      { name: 'Mushroom Egg', price: 245 },
      { name: 'Egg & Shallal Cheese Croissant', price: 280 },
      { name: 'Creamy Salmon Egg', price: 390 },
      { name: 'Buffalo Beef', price: 345 },
      { name: 'Sausage Egg', price: 265 },
      { name: 'Egg Benedict Smoked Salmon', price: 385 },
    ],
  },
  {
    id: 'bakeries',
    name: 'Bakeries',
    tagline: 'Laminated by hand, baked at 4am',
    note: 'Seventy-two hours of cold ferment before anything meets the oven.',
    items: [
      { name: 'Plain Croissant', price: 95 },
      { name: 'Pain Suisse', price: 135 },
      { name: 'Olive & Cheese Croissant', price: 145 },
      { name: 'Pistachio Croissant', price: 150 },
      { name: 'Almond Croissant', price: 155 },
      { name: 'Blueberry Danish', price: 185 },
      { name: 'Mix Cheese Croissant', price: 265 },
      { name: 'Turkey Cheese Croissant', price: 285 },
      { name: 'Roast Beef Croissant', price: 385 },
    ],
  },
  {
    id: 'hot-coffee',
    name: 'Hot Coffee',
    tagline: 'The classics, pulled properly',
    note: 'House blend as standard. Ask for the single origin on bar today.',
    items: [
      { name: 'Espresso', price: 75 },
      { name: 'Espresso Macchiato', price: 95 },
      { name: 'Americano', price: 95 },
      { name: 'Cortado', price: 100 },
      { name: 'Flat White', price: 105 },
      { name: 'Latte', price: 110 },
      { name: 'Cappuccino', price: 110 },
      { name: 'Espresso Affogato', price: 125 },
      { name: 'Espresso Con Panna', price: 130 },
      { name: 'Spanish Latte', price: 150 },
      { name: 'Mocha', price: 150 },
      { name: 'White Mocha', price: 150 },
      { name: 'Caramel Macchiato', price: 165 },
      { name: 'Hot Pistachio Latte', price: 195 },
    ],
  },
  {
    id: 'ice-coffee',
    name: 'Ice Coffee',
    tagline: 'Built over slow-melt ice',
    note: 'Blended options are shaken, then spun — never watery.',
    items: [
      { name: 'Ice Americano', price: 105 },
      { name: 'Ice Latte', price: 115 },
      { name: 'Frappuccino', price: 125 },
      { name: 'Ice Spanish Latte', price: 160 },
      { name: 'Ice Mocha', price: 160 },
      { name: 'Iced Creamy White Mocha', price: 165 },
      { name: 'Ice Caramel Macchiato', price: 170 },
      { name: 'Blended Ice Spanish Latte', price: 175 },
      { name: 'Blended Ice White Mocha', price: 185 },
      { name: 'Ice Pistachio Latte', price: 185 },
      { name: 'Blended Pistachio Latte', price: 195 },
    ],
  },
  {
    id: 'matcha',
    name: 'Matcha',
    tagline: 'Ceremonial grade, whisked to order',
    note: 'Stone-milled and sifted daily — nothing sits open past service.',
    items: [
      { name: 'Hot Spanish Matcha', price: 175 },
      { name: 'Coconut Matcha Cloud', price: 190 },
      { name: 'Banana Bread Matcha', price: 190 },
      { name: 'Ice White Chocolate Matcha', price: 195 },
      { name: 'Mango Matcha Cloud', price: 205 },
      { name: 'Cherry Matcha Cloud', price: 235 },
    ],
  },
  {
    id: 'signatures',
    name: 'Signatures',
    tagline: 'Only at Solis',
    note: 'Our own recipes. Half of them started as a staff experiment.',
    items: [
      { name: 'Passion Orange Soda', price: 145 },
      { name: 'Mango Coconut', price: 150 },
      { name: 'Hot Matcha', price: 160 },
      { name: 'Ice Matcha', price: 160 },
      { name: 'Peach Vanilla Milkshake', price: 165 },
      { name: 'Blue Pineapple Smoothie', price: 165 },
      { name: 'Coffee Cream', price: 175 },
      { name: 'Ice Spanish Matcha', price: 175 },
      { name: 'MC Splash', price: 175 },
      { name: 'Cream Caramel Latte', price: 175 },
      { name: 'Strawberry Matcha', price: 180 },
      { name: 'Banana Caramel Milkshake', price: 185 },
      { name: 'Salted Vanilla Latte', price: 185 },
      { name: 'Piña Colada', price: 190 },
      { name: 'Matcha Coconut', price: 195 },
      { name: 'Pistachio Blend Milkshake', price: 195 },
      { name: 'Berry Mood', price: 195 },
      { name: 'Strawberry Coconut Matcha', price: 215 },
      { name: 'Banoffee Latte', price: 245 },
      { name: 'Blended Pistachio Matcha', price: 265 },
      { name: 'Sun Set', price: 265, signature: true },
    ],
  },
  {
    id: 'lemonade',
    name: 'Refresh Lemonade',
    tagline: 'Pressed fruit, no syrup shortcuts',
    note: 'Every one of them is the same price. Order two.',
    items: [
      { name: 'Pink Lemonade', price: 150 },
      { name: 'Blueberry Lemonade', price: 150 },
      { name: 'Mango Passion', price: 150 },
      { name: 'Coconut Pineapple', price: 150 },
      { name: 'Mango Peach', price: 150 },
      { name: 'Mix Berries', price: 150 },
    ],
  },
  {
    id: 'hot-drinks',
    name: 'Hot Drinks',
    tagline: 'For the non-coffee table',
    note: 'Chocolate is melted, not scooped from a powder tin.',
    items: [
      { name: 'Tea', price: 60 },
      { name: 'Hot Cider', price: 125 },
      { name: 'Hot Chocolate', price: 160 },
      { name: 'Strawberry Hot Chocolate', price: 180 },
      { name: 'Honey Cinnamon Latte', price: 185 },
      { name: 'Peanut Butter Latte', price: 190 },
    ],
  },
  {
    id: 'retail',
    name: 'Retail Beans',
    tagline: 'Take the roast home — 250g bags',
    note: 'Roasted in small batches. We grind to your brewer at the counter, free.',
    items: [
      { name: 'Brazil Cerrado', price: 550, meta: '250g' },
      { name: 'Ethiopia Guji', price: 750, meta: '250g' },
      { name: 'Colombia Pink Bourbon', price: 900, meta: '250g' },
      { name: 'Colombia Infused Peach', price: 1450, meta: '250g' },
    ],
  },
];

export const formatPrice = (value) => value.toLocaleString('en-US');

export const totalItems = menu.reduce((sum, section) => sum + section.items.length, 0);
