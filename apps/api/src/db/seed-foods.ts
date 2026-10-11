import { and, isNull, sql } from 'drizzle-orm';
import type { FoodCategory } from '@fettle/shared';
import { db, schema } from './client.js';

/**
 * Built-in food catalogue: everyday foods with typical values per serving (USDA/IFCT based,
 * rounded). Home-cooked dishes vary a lot, so these are good starting points, not lab results.
 *
 * [name, emoji, category, servingSize, servingUnit, kcal, protein, carbs, fat, fiber, sugar, sodiumMg]
 */
type Row = [string, string, FoodCategory, number, string, number, number, number, number, number, number, number];

const CATALOGUE: Row[] = [
  // grains & breads
  ['White rice, cooked', '🍚', 'grains', 1, 'cup (158 g)', 205, 4.3, 44.5, 0.4, 0.6, 0.1, 2],
  ['Brown rice, cooked', '🍚', 'grains', 1, 'cup (195 g)', 216, 5, 45, 1.8, 3.5, 0.7, 10],
  ['Roti / chapati', '🫓', 'grains', 1, 'medium (40 g)', 110, 3.5, 18, 3, 2.5, 0.4, 120],
  ['Paratha, plain', '🫓', 'grains', 1, 'piece (80 g)', 260, 5, 36, 10, 3, 1, 300],
  ['Aloo paratha', '🫓', 'grains', 1, 'piece (120 g)', 320, 6.5, 45, 13, 4, 2, 420],
  ['Naan', '🫓', 'grains', 1, 'piece (90 g)', 262, 8.7, 45, 5.1, 2, 3, 418],
  ['Idli', '⚪', 'grains', 2, 'pieces (80 g)', 116, 4, 24, 0.4, 1.6, 0.3, 260],
  ['Dosa, plain', '🥞', 'grains', 1, 'piece (85 g)', 168, 3.9, 29, 3.7, 1, 0.3, 280],
  ['Masala dosa', '🥞', 'meals', 1, 'piece (175 g)', 390, 7, 52, 17, 4, 3, 700],
  ['Upma', '🥣', 'grains', 1, 'cup (200 g)', 250, 6, 38, 8, 3, 2, 500],
  ['Poha', '🥣', 'grains', 1, 'cup (160 g)', 270, 5, 45, 8, 2, 2, 400],
  ['Oatmeal, cooked with water', '🥣', 'grains', 1, 'cup (234 g)', 166, 5.9, 28, 3.6, 4, 0.6, 9],
  ['Rolled oats, dry', '🌾', 'grains', 40, 'g', 150, 5.3, 27, 2.7, 4, 0.4, 2],
  ['Whole wheat bread', '🍞', 'grains', 1, 'slice (32 g)', 80, 4, 14, 1.1, 2, 1.6, 140],
  ['White bread', '🍞', 'grains', 1, 'slice (25 g)', 67, 2, 12.7, 0.8, 0.6, 1.4, 120],
  ['Pasta, cooked', '🍝', 'grains', 1, 'cup (140 g)', 220, 8, 43, 1.3, 2.5, 0.8, 1],
  ['Quinoa, cooked', '🌾', 'grains', 1, 'cup (185 g)', 222, 8.1, 39, 3.6, 5.2, 1.6, 13],
  ['Corn flakes', '🥣', 'grains', 30, 'g', 113, 2, 25, 0.2, 0.9, 2.4, 200],
  ['Muesli', '🥣', 'grains', 45, 'g', 170, 4.5, 30, 3, 3.5, 9, 30],
  ['Bagel', '🥯', 'grains', 1, 'bagel (98 g)', 270, 10.5, 53, 1.7, 2.3, 5.4, 430],
  ['Wheat tortilla', '🌯', 'grains', 1, 'tortilla (45 g)', 140, 3.7, 23, 3.6, 1.6, 1, 330],
  ['Khichdi', '🥣', 'meals', 1, 'cup (200 g)', 220, 8, 36, 5, 4, 1, 450],
  ['Veg biryani', '🍛', 'meals', 1, 'cup (200 g)', 290, 6, 44, 10, 3, 3, 600],
  ['Chicken biryani', '🍛', 'meals', 1, 'plate (300 g)', 500, 25, 60, 17, 3, 3, 900],

  // protein
  ['Chicken breast, grilled', '🍗', 'protein', 100, 'g', 165, 31, 0, 3.6, 0, 0, 74],
  ['Chicken curry', '🍛', 'protein', 1, 'cup (240 g)', 290, 25, 8, 18, 2, 3, 700],
  ['Chicken tikka', '🍢', 'protein', 6, 'pieces (150 g)', 230, 33, 4, 9, 1, 2, 650],
  ['Tandoori chicken', '🍗', 'protein', 1, 'leg (150 g meat)', 260, 34, 4, 12, 1, 2, 700],
  ['Egg, boiled', '🥚', 'protein', 1, 'large egg', 78, 6.3, 0.6, 5.3, 0, 0.6, 62],
  ['Omelette (2 eggs)', '🍳', 'protein', 1, 'omelette', 190, 13, 1.5, 15, 0, 1, 330],
  ['Egg white', '🥚', 'protein', 1, 'large egg', 17, 3.6, 0.2, 0.1, 0, 0.2, 55],
  ['Egg bhurji', '🍳', 'protein', 1, 'cup (150 g)', 240, 15, 5, 18, 1, 2, 450],
  ['Salmon, cooked', '🐟', 'protein', 100, 'g', 206, 22, 0, 12, 0, 0, 61],
  ['Tuna, canned in water', '🐟', 'protein', 100, 'g', 116, 26, 0, 0.8, 0, 0, 247],
  ['Fish curry', '🍛', 'protein', 1, 'cup (240 g)', 250, 22, 6, 15, 1, 2, 650],
  ['Prawns, cooked', '🦐', 'protein', 100, 'g', 99, 24, 0.2, 0.3, 0, 0, 111],
  ['Mutton curry', '🍖', 'protein', 1, 'cup (240 g)', 380, 28, 6, 27, 1, 2, 750],
  ['Lean beef mince, cooked', '🥩', 'protein', 100, 'g', 217, 26, 0, 12, 0, 0, 72],
  ['Turkey breast', '🦃', 'protein', 100, 'g', 135, 30, 0, 1, 0, 0, 55],
  ['Paneer', '🧀', 'protein', 100, 'g', 265, 18, 1.2, 21, 0, 1.2, 18],
  ['Paneer butter masala', '🍛', 'protein', 1, 'cup (240 g)', 420, 16, 14, 34, 2, 6, 800],
  ['Tofu, firm', '⬜', 'protein', 100, 'g', 144, 17, 2.8, 8.7, 2.3, 0.6, 14],
  ['Soya chunks, dry', '🟤', 'protein', 50, 'g', 173, 26, 16.5, 0.3, 6.5, 0, 10],
  ['Whey protein', '🥤', 'protein', 1, 'scoop (30 g)', 120, 24, 3, 1.5, 0, 2, 50],

  // dairy
  ['Milk, whole', '🥛', 'dairy', 1, 'cup (244 ml)', 149, 7.7, 11.7, 7.9, 0, 12.3, 105],
  ['Milk, skimmed', '🥛', 'dairy', 1, 'cup (244 ml)', 83, 8.3, 12, 0.2, 0, 12, 103],
  ['Curd / plain yogurt', '🥣', 'dairy', 1, 'cup (245 g)', 149, 8.5, 11.4, 8, 0, 11.4, 113],
  ['Greek yogurt, nonfat', '🥣', 'dairy', 1, 'pot (170 g)', 100, 17, 6, 0.7, 0, 6, 61],
  ['Cheddar cheese', '🧀', 'dairy', 1, 'slice (28 g)', 113, 7, 0.4, 9.3, 0, 0.1, 174],
  ['Mozzarella', '🧀', 'dairy', 28, 'g', 85, 6.3, 0.6, 6.3, 0, 0.3, 178],
  ['Buttermilk (chaas)', '🥛', 'dairy', 1, 'glass (250 ml)', 60, 3, 5, 3, 0, 4, 250],
  ['Sweet lassi', '🥛', 'dairy', 1, 'glass (250 ml)', 260, 8, 42, 7, 0, 40, 120],

  // fruit
  ['Banana', '🍌', 'fruit', 1, 'medium (118 g)', 105, 1.3, 27, 0.4, 3.1, 14.4, 1],
  ['Apple', '🍎', 'fruit', 1, 'medium (182 g)', 95, 0.5, 25, 0.3, 4.4, 19, 2],
  ['Orange', '🍊', 'fruit', 1, 'medium (131 g)', 62, 1.2, 15.4, 0.2, 3.1, 12.2, 0],
  ['Mango', '🥭', 'fruit', 1, 'cup sliced (165 g)', 99, 1.4, 24.7, 0.6, 2.6, 22.5, 2],
  ['Papaya', '🍈', 'fruit', 1, 'cup (145 g)', 62, 0.7, 15.7, 0.4, 2.5, 11.3, 12],
  ['Grapes', '🍇', 'fruit', 1, 'cup (151 g)', 104, 1.1, 27.3, 0.2, 1.4, 23.4, 3],
  ['Watermelon', '🍉', 'fruit', 1, 'cup (152 g)', 46, 0.9, 11.5, 0.2, 0.6, 9.4, 2],
  ['Strawberries', '🍓', 'fruit', 1, 'cup (152 g)', 49, 1, 11.7, 0.5, 3, 7.4, 2],
  ['Blueberries', '🫐', 'fruit', 1, 'cup (148 g)', 84, 1.1, 21.4, 0.5, 3.6, 14.7, 1],
  ['Pomegranate seeds', '🍎', 'fruit', 0.5, 'cup (87 g)', 72, 1.5, 16.3, 1, 3.5, 12, 3],
  ['Guava', '🍐', 'fruit', 1, 'fruit (55 g)', 37, 1.4, 7.9, 0.5, 3, 4.9, 1],
  ['Pineapple', '🍍', 'fruit', 1, 'cup (165 g)', 82, 0.9, 21.6, 0.2, 2.3, 16.3, 2],
  ['Avocado', '🥑', 'fruit', 0.5, 'fruit (100 g)', 160, 2, 8.5, 14.7, 6.7, 0.7, 7],
  ['Dates', '🌴', 'fruit', 2, 'medjool (48 g)', 133, 0.9, 36, 0.1, 3.2, 32, 1],
  ['Kiwi', '🥝', 'fruit', 1, 'fruit (69 g)', 42, 0.8, 10.1, 0.4, 2.1, 6.2, 2],
  ['Pear', '🍐', 'fruit', 1, 'medium (178 g)', 101, 0.6, 27, 0.3, 5.5, 17, 2],

  // vegetables
  ['Green salad', '🥗', 'vegetables', 1, 'bowl (150 g)', 30, 1.8, 6, 0.3, 2.3, 3, 30],
  ['Broccoli, steamed', '🥦', 'vegetables', 1, 'cup (156 g)', 55, 3.7, 11.2, 0.6, 5.1, 2.2, 64],
  ['Spinach, cooked', '🥬', 'vegetables', 1, 'cup (180 g)', 41, 5.3, 6.8, 0.5, 4.3, 0.8, 126],
  ['Aloo sabzi', '🥔', 'vegetables', 1, 'cup (200 g)', 220, 3.5, 28, 11, 3.5, 3, 500],
  ['Mixed veg curry', '🍛', 'vegetables', 1, 'cup (200 g)', 180, 4, 16, 11, 5, 5, 550],
  ['Palak paneer', '🍛', 'vegetables', 1, 'cup (240 g)', 300, 14, 10, 23, 4, 3, 650],
  ['Bhindi fry', '🫛', 'vegetables', 1, 'cup (150 g)', 160, 3, 12, 11, 5, 3, 350],
  ['Baked potato', '🥔', 'vegetables', 1, 'medium (173 g)', 161, 4.3, 36.6, 0.2, 3.8, 2, 17],
  ['Sweet potato, baked', '🍠', 'vegetables', 1, 'medium (114 g)', 103, 2.3, 23.6, 0.2, 3.8, 7.4, 41],
  ['Carrot', '🥕', 'vegetables', 1, 'medium (61 g)', 25, 0.6, 5.8, 0.1, 1.7, 2.9, 42],
  ['Cucumber', '🥒', 'vegetables', 1, 'cup sliced (104 g)', 16, 0.7, 3.8, 0.1, 0.5, 1.7, 2],
  ['Tomato', '🍅', 'vegetables', 1, 'medium (123 g)', 22, 1.1, 4.8, 0.2, 1.5, 3.2, 6],
  ['Sambar', '🍲', 'vegetables', 1, 'cup (240 g)', 140, 6, 20, 4, 5, 4, 600],
  ['Rasam', '🍲', 'vegetables', 1, 'cup (240 g)', 60, 2, 9, 2, 1.5, 2, 550],

  // legumes
  ['Dal (toor), cooked', '🍲', 'legumes', 1, 'cup (240 g)', 200, 11, 28, 5, 6, 2, 450],
  ['Dal makhani', '🍲', 'legumes', 1, 'cup (240 g)', 330, 13, 30, 18, 9, 3, 600],
  ['Rajma curry', '🫘', 'legumes', 1, 'cup (240 g)', 250, 12, 35, 7, 10, 3, 550],
  ['Chole (chickpea curry)', '🫘', 'legumes', 1, 'cup (240 g)', 280, 12, 38, 9, 10, 6, 600],
  ['Chickpeas, boiled', '🫘', 'legumes', 1, 'cup (164 g)', 269, 14.5, 45, 4.2, 12.5, 7.9, 11],
  ['Lentils, boiled', '🫘', 'legumes', 1, 'cup (198 g)', 230, 17.9, 39.9, 0.8, 15.6, 3.6, 4],
  ['Black beans, boiled', '🫘', 'legumes', 1, 'cup (172 g)', 227, 15.2, 40.8, 0.9, 15, 0.6, 2],
  ['Moong sprouts', '🌱', 'legumes', 1, 'cup (104 g)', 31, 3.2, 6.2, 0.2, 1.9, 4.3, 6],
  ['Hummus', '🫙', 'legumes', 2, 'tbsp (30 g)', 70, 2, 4, 5, 1.8, 0.1, 115],

  // nuts & seeds
  ['Almonds', '🌰', 'nuts', 28, 'g (~23 nuts)', 164, 6, 6.1, 14.2, 3.5, 1.2, 0],
  ['Walnuts', '🌰', 'nuts', 28, 'g', 185, 4.3, 3.9, 18.5, 1.9, 0.7, 1],
  ['Cashews', '🌰', 'nuts', 28, 'g', 157, 5.2, 8.6, 12.4, 0.9, 1.7, 3],
  ['Peanuts, roasted', '🥜', 'nuts', 28, 'g', 166, 6.7, 6.1, 14.1, 2.3, 1.2, 2],
  ['Pistachios', '🌰', 'nuts', 28, 'g', 159, 5.7, 7.7, 12.8, 3, 2.2, 0],
  ['Peanut butter', '🥜', 'nuts', 2, 'tbsp (32 g)', 190, 7, 8, 16, 2, 3, 140],
  ['Chia seeds', '⚫', 'nuts', 1, 'tbsp (12 g)', 58, 2, 5, 3.7, 4.1, 0, 2],
  ['Flaxseed, ground', '🟤', 'nuts', 1, 'tbsp (10 g)', 55, 1.9, 3, 4.3, 2.8, 0.2, 3],

  // snacks
  ['Samosa', '🥟', 'snacks', 1, 'piece (100 g)', 262, 4, 32, 13, 3, 2, 420],
  ['Pakora', '🧆', 'snacks', 4, 'pieces (80 g)', 230, 5, 20, 15, 3, 1.5, 380],
  ['Vada pav', '🍔', 'snacks', 1, 'piece (150 g)', 300, 7, 42, 12, 4, 4, 600],
  ['Pani puri', '🫧', 'snacks', 6, 'pieces', 220, 4, 30, 9, 3, 6, 500],
  ['Bhel puri', '🥗', 'snacks', 1, 'cup (100 g)', 230, 5, 35, 8, 3, 6, 450],
  ['Dhokla', '🟨', 'snacks', 4, 'pieces (120 g)', 190, 7, 28, 6, 2, 5, 560],
  ['Potato chips', '🥔', 'snacks', 28, 'g', 152, 2, 15, 9.8, 1.2, 0.1, 148],
  ['Popcorn, air-popped', '🍿', 'snacks', 3, 'cups (24 g)', 93, 3, 18.6, 1.1, 3.6, 0.2, 2],
  ['Protein bar', '🍫', 'snacks', 1, 'bar (60 g)', 210, 20, 22, 7, 5, 4, 200],
  ['Digestive biscuits', '🍪', 'snacks', 2, 'biscuits (30 g)', 142, 2.1, 19.4, 6.3, 1.1, 5, 180],
  ['Granola', '🥣', 'snacks', 0.5, 'cup (60 g)', 280, 6, 36, 13, 4, 14, 20],
  ['Rice cakes', '⚪', 'snacks', 2, 'cakes (18 g)', 70, 1.4, 14.7, 0.5, 0.8, 0.1, 58],
  ['Trail mix', '🥜', 'snacks', 40, 'g', 190, 5, 18, 12, 2, 12, 60],

  // drinks
  ['Masala chai (milk & sugar)', '☕', 'drinks', 1, 'cup (150 ml)', 105, 3, 15, 3.5, 0, 13, 40],
  ['Black coffee', '☕', 'drinks', 1, 'cup (240 ml)', 2, 0.3, 0, 0, 0, 0, 5],
  ['Cappuccino', '☕', 'drinks', 1, 'cup (240 ml)', 120, 6.4, 9.6, 6.4, 0, 9, 100],
  ['Green tea', '🍵', 'drinks', 1, 'cup (240 ml)', 2, 0.5, 0, 0, 0, 0, 2],
  ['Orange juice', '🧃', 'drinks', 1, 'cup (248 ml)', 112, 1.7, 25.8, 0.5, 0.5, 20.8, 2],
  ['Coconut water', '🥥', 'drinks', 1, 'cup (240 ml)', 46, 1.7, 8.9, 0.5, 2.6, 6.3, 252],
  ['Cola', '🥤', 'drinks', 1, 'can (330 ml)', 139, 0, 35, 0, 0, 35, 15],
  ['Sugarcane juice', '🧃', 'drinks', 1, 'glass (240 ml)', 180, 0.3, 45, 0.4, 0, 42, 20],
  ['Beer', '🍺', 'drinks', 1, 'bottle (330 ml)', 145, 1.6, 12.8, 0, 0, 0, 14],
  ['Red wine', '🍷', 'drinks', 1, 'glass (150 ml)', 125, 0.1, 3.8, 0, 0, 0.9, 6],

  // sweets
  ['Gulab jamun', '🟤', 'sweets', 2, 'pieces (80 g)', 300, 4, 44, 12, 0.5, 35, 60],
  ['Rasgulla', '⚪', 'sweets', 2, 'pieces (100 g)', 186, 4, 40, 1.7, 0, 36, 20],
  ['Jalebi', '🟠', 'sweets', 2, 'pieces (50 g)', 190, 1.5, 30, 7.5, 0.3, 22, 10],
  ['Kheer', '🍮', 'sweets', 1, 'cup (200 g)', 300, 8, 45, 9, 0.5, 35, 100],
  ['Besan ladoo', '🟡', 'sweets', 1, 'piece (40 g)', 190, 3.5, 20, 11, 1, 13, 15],
  ['Vanilla ice cream', '🍨', 'sweets', 0.5, 'cup (66 g)', 137, 2.3, 15.6, 7.3, 0.5, 14, 53],
  ['Chocolate chip cookie', '🍪', 'sweets', 1, 'cookie (30 g)', 140, 1.6, 19, 7, 0.7, 10, 95],
  ['Dark chocolate 70%', '🍫', 'sweets', 20, 'g', 120, 1.6, 9, 8.5, 2.2, 4.8, 4],
  ['Honey', '🍯', 'sweets', 1, 'tbsp (21 g)', 64, 0.1, 17.3, 0, 0, 17.2, 1],
  ['Sugar', '🧂', 'sweets', 1, 'tsp (4 g)', 16, 0, 4, 0, 0, 4, 0],

  // meals
  ['Margherita pizza', '🍕', 'meals', 1, 'slice (107 g)', 250, 11, 31, 9, 2, 3.6, 590],
  ['Cheeseburger', '🍔', 'meals', 1, 'burger (150 g)', 300, 15, 33, 12, 2, 7, 720],
  ['Chicken Caesar salad', '🥗', 'meals', 1, 'bowl (300 g)', 440, 32, 14, 28, 3, 3, 1000],
  ['Grilled chicken salad', '🥗', 'meals', 1, 'bowl (350 g)', 350, 35, 15, 16, 5, 6, 700],
  ['Chicken sandwich', '🥪', 'meals', 1, 'sandwich (200 g)', 400, 28, 40, 14, 3, 6, 900],
  ['Spaghetti bolognese', '🍝', 'meals', 1, 'plate (350 g)', 520, 26, 62, 18, 5, 8, 800],
  ['California roll', '🍣', 'meals', 8, 'pieces (220 g)', 255, 9, 38, 7, 3, 8, 430],
  ['Chicken burrito', '🌯', 'meals', 1, 'burrito (300 g)', 600, 32, 70, 20, 8, 3, 1300],
  ['Chicken shawarma wrap', '🌯', 'meals', 1, 'wrap (250 g)', 520, 30, 45, 24, 3, 4, 1200],
  ['Veg fried rice', '🍚', 'meals', 1, 'cup (200 g)', 333, 8, 45, 12, 1.5, 2, 700],
  ['Hakka noodles', '🍜', 'meals', 1, 'plate (250 g)', 400, 9, 58, 14, 3, 4, 1000],
  ['Instant noodles', '🍜', 'meals', 1, 'pack (70 g)', 310, 7, 44, 12, 2, 2, 950],
  ['Pav bhaji', '🍛', 'meals', 1, 'plate (300 g)', 550, 13, 75, 22, 9, 10, 1200],
  ['Veg thali', '🍱', 'meals', 1, 'plate (600 g)', 850, 25, 120, 30, 15, 12, 1800],

  // fats & oils
  ['Olive oil', '🫒', 'fats', 1, 'tbsp (13.5 g)', 119, 0, 0, 13.5, 0, 0, 0],
  ['Cooking oil', '🫗', 'fats', 1, 'tsp (4.5 g)', 40, 0, 0, 4.5, 0, 0, 0],
  ['Ghee', '🧈', 'fats', 1, 'tsp (5 g)', 45, 0, 0, 5, 0, 0, 0],
  ['Butter', '🧈', 'fats', 1, 'tbsp (14 g)', 102, 0.1, 0, 11.5, 0, 0, 91],
];

/** Adds any catalogue foods that aren't in the database yet. Safe to run on every start. */
export async function seedFoodCatalogue() {
  const existing = await db
    .select({ name: schema.foods.name })
    .from(schema.foods)
    .where(and(isNull(schema.foods.userId), isNull(schema.foods.deletedAt)));
  const have = new Set(existing.map((f) => f.name));
  const missing = CATALOGUE.filter(([name]) => !have.has(name));
  if (!missing.length) return;

  await db.insert(schema.foods).values(
    missing.map(([name, emoji, category, servingSize, servingUnit, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg]) => ({
      name,
      emoji,
      category,
      servingSize,
      servingUnit,
      calories,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      sugarG,
      sodiumMg,
    })),
  );
  // Keep the planner's statistics fresh for the trigram index after a bulk insert.
  await db.execute(sql`analyze foods`);
  console.log(`Added ${missing.length} foods to the catalogue.`);
}
