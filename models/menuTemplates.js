// Sample Singapore hawker menus for new stalls
// The system matches the stall name (and cuisine type if available)
// to the closest menu using simple keywords
const TEMPLATES = {
  chickenRice: {
    keywords: ["chicken rice"],
    category: "Rice",
    items: [
      { itemName: "Steamed Chicken Rice", price: 4.5, description: "Contains: chicken, rice, soy sauce, ginger, garlic, sesame oil" },
      { itemName: "Roasted Chicken Rice", price: 4.5, description: "Contains: chicken, rice, five-spice, soy sauce, dark caramel" },
      { itemName: "Boneless Chicken Rice", price: 5.5, description: "Contains: chicken, rice, cucumber, chilli, ginger paste" },
      { itemName: "Chicken Rice Set (Half Chicken)", price: 12.0, description: "Contains: chicken, rice, chilli sauce, dark soy sauce" },
      { itemName: "Chicken Rice Set (Whole Chicken)", price: 22.0, description: "Contains: chicken, rice, chilli sauce, dark soy sauce, achar" },
      { itemName: "Extra Chicken Rice (Plain)", price: 1.0, description: "Contains: rice, chicken oil, pandan leaf" },
      { itemName: "Chicken Soup", price: 1.5, description: "Contains: chicken broth, spring onion, white pepper" },
      { itemName: "Herbal Chicken Soup", price: 3.5, description: "Contains: chicken, chinese herbs, red dates, goji berries" },
      { itemName: "Achar (Pickled Vegetables)", price: 1.5, description: "Contains: cucumber, carrot, pineapple, peanuts, chilli, vinegar" },
      { itemName: "Steamed Vegetables with Oyster Sauce", price: 3.0, description: "Contains: seasonal greens, oyster sauce, garlic" },
      { itemName: "Chicken Feet", price: 2.5, description: "Contains: chicken feet, black bean sauce, chilli" },
      { itemName: "Roasted Chicken Wings (3pc)", price: 3.5, description: "Contains: chicken wings, five-spice, honey glaze" },
      { itemName: "Bean Sprouts with Chicken Oil", price: 2.5, description: "Contains: bean sprouts, chicken oil, soy sauce" },
      { itemName: "Chicken Liver", price: 2.0, description: "Contains: chicken liver, soy sauce, ginger" },
      { itemName: "Chicken Gizzard", price: 2.0, description: "Contains: chicken gizzard, five-spice, soy sauce" },
      { itemName: "Steamed Chicken Breast (Extra)", price: 3.0, description: "Contains: chicken breast, ginger, spring onion oil" },
      { itemName: "Chilli Sauce (Extra)", price: 0.5, description: "Contains: chilli, ginger, garlic, lime juice" },
      { itemName: "Ginger Paste (Extra)", price: 0.5, description: "Contains: ginger, spring onion, oil, salt" },
      { itemName: "Fried Chicken Skin", price: 2.0, description: "Contains: chicken skin, salt, five-spice" },
      { itemName: "Chicken Rice Balls (Hainanese Style, 3pc)", price: 3.0, description: "Contains: rice, chicken broth, pandan leaf" },
      { itemName: "Braised Peanuts", price: 1.5, description: "Contains: peanuts, star anise, soy sauce" },
      { itemName: "Century Egg with Pickled Ginger", price: 2.5, description: "Contains: century egg, pickled ginger" },
      { itemName: "Tofu with Century Egg", price: 3.0, description: "Contains: silken tofu, century egg, soy sauce, spring onion" },
      { itemName: "Chinese Kale with Oyster Sauce", price: 3.5, description: "Contains: chinese kale, oyster sauce, garlic oil" },
      { itemName: "Iced Chrysanthemum Tea", price: 1.5, description: "Contains: chrysanthemum flower, rock sugar, water" },
      { itemName: "Winter Melon Tea", price: 1.5, description: "Contains: winter melon, rock sugar" },
      { itemName: "Barley Water", price: 1.5, description: "Contains: barley, water" },
      { itemName: "Soybean Milk", price: 1.5, description: "Contains: soybean, sugar" },
      { itemName: "Kids' Chicken Rice Set", price: 6.0, description: "Contains: chicken, rice, mild soy sauce, cut into small pieces" },
      { itemName: "Fried Chicken Drumstick", price: 3.0, description: "Contains: chicken drumstick, five-spice batter" }
    ]
  },
  charKwayTeow: {
    keywords: ["char kway teow", "kway teow", "ckt"],
    category: "Noodles",
    items: [
      { itemName: "Fried Kway Teow", price: 5.0, description: "Contains: flat rice noodles, cockles, egg, bean sprouts, chinese sausage, dark soy sauce" },
      { itemName: "Fried Kway Teow (Large)", price: 7.0, description: "Contains: flat rice noodles, cockles, egg, bean sprouts, chinese sausage" },
      { itemName: "Fried Kway Teow with Extra Cockles", price: 7.5, description: "Contains: flat rice noodles, extra cockles, egg, chilli paste" },
      { itemName: "Fried Kway Teow (No Cockles)", price: 5.0, description: "Contains: flat rice noodles, egg, bean sprouts, chinese sausage" },
      { itemName: "Fried Kway Teow with Prawns", price: 6.5, description: "Contains: flat rice noodles, prawns, egg, bean sprouts, chilli paste" },
      { itemName: "Fried Kway Teow with Sotong (Squid)", price: 6.5, description: "Contains: flat rice noodles, squid, egg, bean sprouts" },
      { itemName: "Seafood Fried Kway Teow", price: 8.0, description: "Contains: flat rice noodles, prawns, squid, cockles, egg" },
      { itemName: "Fried Hokkien Mee", price: 5.5, description: "Contains: yellow noodles, rice vermicelli, prawn, egg, pork lard" },
      { itemName: "Fried Hokkien Mee (Large)", price: 7.5, description: "Contains: yellow noodles, rice vermicelli, prawn, squid, egg, pork lard" },
      { itemName: "Fried Carrot Cake (Black)", price: 4.0, description: "Contains: radish cake, dark sweet sauce, egg, preserved radish" },
      { itemName: "Fried Carrot Cake (White)", price: 4.0, description: "Contains: radish cake, egg, preserved radish, garlic" },
      { itemName: "Fried Carrot Cake (Large)", price: 5.5, description: "Contains: radish cake, egg, preserved radish, choice of sauce" },
      { itemName: "Fried Oyster Omelette (Orh Luak)", price: 6.0, description: "Contains: oyster, egg, sweet potato starch, chilli sauce" },
      { itemName: "Fried Mee Sua", price: 4.5, description: "Contains: wheat vermicelli, egg, dark soy sauce" },
      { itemName: "Chilli Paste (Extra)", price: 0.5, description: "Contains: chilli, vinegar, garlic" },
      { itemName: "Fried Egg (Extra)", price: 1.0, description: "Contains: egg" },
      { itemName: "Extra Chinese Sausage (Lup Cheong)", price: 1.5, description: "Contains: chinese sausage, sugar, spices" },
      { itemName: "Beansprouts (Extra)", price: 1.0, description: "Contains: beansprouts, garlic oil" },
      { itemName: "Fried Prawn Fritters (3pc)", price: 3.0, description: "Contains: prawn, batter, sweet potato" },
      { itemName: "Iced Barley Water", price: 1.5, description: "Contains: barley, winter melon, water" },
      { itemName: "Sugar Cane Juice", price: 2.0, description: "Contains: sugar cane, lime" },
      { itemName: "100 Plus (Can)", price: 1.8, description: "Contains: carbonated isotonic drink" },
      { itemName: "Iced Lime Juice", price: 2.0, description: "Contains: lime, sugar syrup, water" }
    ]
  },
  laksa: {
    keywords: ["laksa"],
    category: "Noodles",
    items: [
      { itemName: "Laksa", price: 5.0, description: "Contains: rice vermicelli, coconut gravy, prawn, fishcake, tau pok, cockles" },
      { itemName: "Laksa (Large)", price: 6.5, description: "Contains: rice vermicelli, coconut gravy, prawn, fishcake, tau pok" },
      { itemName: "Laksa with Extra Prawns", price: 7.5, description: "Contains: rice vermicelli, coconut gravy, extra prawns, cockles" },
      { itemName: "Laksa with Extra Cockles", price: 6.5, description: "Contains: rice vermicelli, coconut gravy, extra cockles, tau pok" },
      { itemName: "Chicken Laksa", price: 6.0, description: "Contains: rice vermicelli, coconut gravy, shredded chicken, tau pok" },
      { itemName: "Vegetarian Laksa", price: 5.0, description: "Contains: rice vermicelli, coconut gravy, tau pok, beansprouts, mock meat" },
      { itemName: "Katong Laksa (Cut Noodles)", price: 5.5, description: "Contains: cut rice vermicelli, coconut gravy, prawn, fishcake, cockles" },
      { itemName: "Otah (Grilled Fish Cake)", price: 2.0, description: "Contains: fish paste, coconut milk, chilli, banana leaf" },
      { itemName: "Otah (Large, 2pc)", price: 3.5, description: "Contains: fish paste, coconut milk, chilli, banana leaf" },
      { itemName: "Tau Pok (Beancurd Puff)", price: 1.5, description: "Contains: fried beancurd puff, laksa gravy" },
      { itemName: "Fishcake Slices (Extra)", price: 2.0, description: "Contains: fishcake, laksa gravy" },
      { itemName: "Hard-Boiled Egg (Extra)", price: 1.0, description: "Contains: egg" },
      { itemName: "Sambal Belacan (Side)", price: 0.5, description: "Contains: chilli, belacan, lime" },
      { itemName: "Iced Lemon Tea", price: 1.8, description: "Contains: black tea, lemon, sugar syrup" },
      { itemName: "Iced Milo", price: 2.0, description: "Contains: milo powder, milk, ice" },
      { itemName: "Bandung (Rose Milk)", price: 1.8, description: "Contains: rose syrup, condensed milk, water" }
    ]
  },
  nasiLemak: {
    keywords: ["nasi lemak"],
    category: "Rice",
    items: [
      { itemName: "Nasi Lemak with Fried Chicken", price: 5.0, description: "Contains: coconut rice, fried chicken, sambal, ikan bilis, peanuts, egg" },
      { itemName: "Nasi Lemak with Fish", price: 5.5, description: "Contains: coconut rice, fried fish, sambal, ikan bilis, cucumber" },
      { itemName: "Nasi Lemak with Rendang", price: 6.0, description: "Contains: coconut rice, beef rendang, sambal, egg" },
      { itemName: "Nasi Lemak with Otah", price: 5.5, description: "Contains: coconut rice, otah, sambal, ikan bilis, peanuts" },
      { itemName: "Nasi Lemak with Sotong Sambal", price: 6.0, description: "Contains: coconut rice, squid sambal, ikan bilis, peanuts" },
      { itemName: "Nasi Lemak (Vegetarian)", price: 3.5, description: "Contains: coconut rice, sambal, ikan bilis, peanuts, cucumber, egg" },
      { itemName: "Nasi Lemak Set (Chicken + Egg + Otah)", price: 7.5, description: "Contains: coconut rice, fried chicken, egg, otah, sambal" },
      { itemName: "Rendang Beef (Side)", price: 3.5, description: "Contains: beef, coconut milk, lemongrass, chilli" },
      { itemName: "Fried Ikan Kuning", price: 2.5, description: "Contains: fried yellowtail fish, turmeric, salt" },
      { itemName: "Extra Sambal Chilli", price: 0.5, description: "Contains: chilli, shallots, belacan, sugar" },
      { itemName: "Fried Egg", price: 1.0, description: "Contains: egg, cooking oil" },
      { itemName: "Fried Anchovies and Peanuts (Extra)", price: 1.0, description: "Contains: ikan bilis, peanuts" },
      { itemName: "Cucumber Slices (Extra)", price: 0.5, description: "Contains: cucumber" },
      { itemName: "Fried Chicken Wing (Extra)", price: 2.0, description: "Contains: chicken wing, turmeric batter" },
      { itemName: "Luncheon Meat Slice (Fried)", price: 1.5, description: "Contains: luncheon meat" },
      { itemName: "Iced Milo", price: 2.0, description: "Contains: milo powder, milk, ice" },
      { itemName: "Teh Tarik", price: 2.0, description: "Contains: black tea, condensed milk, evaporated milk" },
      { itemName: "Bandung (Rose Milk)", price: 1.8, description: "Contains: rose syrup, condensed milk, water" }
    ]
  },
  prata: {
    keywords: ["prata", "roti"],
    category: "Indian",
    items: [
      { itemName: "Plain Prata", price: 1.2, description: "Contains: flour dough, ghee, curry sauce" },
      { itemName: "Egg Prata", price: 1.8, description: "Contains: flour dough, egg, ghee, curry sauce" },
      { itemName: "Cheese Prata", price: 2.5, description: "Contains: flour dough, cheese, ghee, curry sauce" },
      { itemName: "Egg & Cheese Prata", price: 3.0, description: "Contains: flour dough, egg, cheese, ghee" },
      { itemName: "Onion Prata", price: 2.0, description: "Contains: flour dough, onion, ghee, curry sauce" },
      { itemName: "Garlic Cheese Prata", price: 2.8, description: "Contains: flour dough, garlic, cheese, ghee" },
      { itemName: "Chocolate Prata", price: 2.2, description: "Contains: flour dough, chocolate spread, ghee" },
      { itemName: "Banana Prata", price: 2.2, description: "Contains: flour dough, banana, ghee, sugar" },
      { itemName: "Mushroom Prata", price: 2.5, description: "Contains: flour dough, mushroom, ghee, curry sauce" },
      { itemName: "Prata Bomb (Mataba)", price: 4.5, description: "Contains: flour dough, minced meat, egg, spices" },
      { itemName: "Murtabak (Mutton)", price: 5.5, description: "Contains: flour dough, minced mutton, egg, onion, spices" },
      { itemName: "Murtabak (Chicken)", price: 5.0, description: "Contains: flour dough, minced chicken, egg, onion, spices" },
      { itemName: "Thosai (Plain)", price: 2.0, description: "Contains: rice and lentil batter, curry sauce" },
      { itemName: "Masala Thosai", price: 3.5, description: "Contains: rice and lentil batter, spiced potato filling" },
      { itemName: "Chicken Briyani", price: 6.5, description: "Contains: basmati rice, chicken, spices, raita" },
      { itemName: "Mutton Curry (Side)", price: 5.0, description: "Contains: mutton, curry gravy, spices" },
      { itemName: "Dhal Curry (Side)", price: 1.5, description: "Contains: lentils, spices, ghee" },
      { itemName: "Teh Tarik", price: 2.0, description: "Contains: black tea, condensed milk, evaporated milk" },
      { itemName: "Milo Dinosaur", price: 3.0, description: "Contains: milo powder, milk, extra milo powder topping" },
      { itemName: "Kopi", price: 1.6, description: "Contains: coffee, condensed milk" },
      { itemName: "Lassi (Mango)", price: 2.5, description: "Contains: yoghurt, mango pulp, sugar" }
    ]
  },
  noodleSoup: {
    keywords: ["fishball", "mee pok", "noodle", "mee"],
    category: "Noodles",
    items: [
      { itemName: "Fishball Noodle (Soup)", price: 4.0, description: "Contains: mee pok/bee hoon, fishball, minced pork, fishcake, spring onion" },
      { itemName: "Fishball Noodle (Dry)", price: 4.5, description: "Contains: mee pok, fishball, minced pork, chilli, vinegar" },
      { itemName: "Fishball Soup (Extra)", price: 3.0, description: "Contains: fishball, clear broth, spring onion" },
      { itemName: "Minced Meat Noodle", price: 4.5, description: "Contains: mee pok, minced pork, mushroom, vinegar" },
      { itemName: "Minced Meat Noodle with Liver", price: 5.0, description: "Contains: mee pok, minced pork, pork liver, mushroom" },
      { itemName: "Fish Ball and Meatball Noodle", price: 5.0, description: "Contains: mee pok, fishball, pork meatball, minced pork" },
      { itemName: "Extra Fishball (5pc)", price: 2.0, description: "Contains: fishball, soup broth" },
      { itemName: "Extra Meatball (5pc)", price: 2.5, description: "Contains: pork meatball, soup broth" },
      { itemName: "Sliced Fish Soup", price: 5.5, description: "Contains: sliced fish, milk broth, bittergourd, tofu" },
      { itemName: "Fried Fish Soup", price: 5.5, description: "Contains: fried fish, milk broth, bittergourd" },
      { itemName: "Fish Maw Soup", price: 6.5, description: "Contains: fish maw, sliced fish, milk broth" },
      { itemName: "Yong Tau Foo (5pc, Soup)", price: 4.0, description: "Contains: stuffed tofu, vegetables, fish paste, clear broth" },
      { itemName: "Yong Tau Foo (5pc, Dry)", price: 4.5, description: "Contains: stuffed tofu, vegetables, fish paste, laksa or chilli sauce" },
      { itemName: "Prawn Noodle (Soup)", price: 5.5, description: "Contains: yellow noodles, prawn, pork ribs, broth" },
      { itemName: "Prawn Noodle (Dry)", price: 6.0, description: "Contains: yellow noodles, prawn, pork ribs, chilli paste" },
      { itemName: "Iced Green Tea", price: 1.5, description: "Contains: green tea, honey, ice" },
      { itemName: "Iced Chrysanthemum Tea", price: 1.5, description: "Contains: chrysanthemum flower, rock sugar" },
      { itemName: "Grass Jelly Drink", price: 1.8, description: "Contains: grass jelly, sugar syrup, ice" }
    ]
  },
  bakKutTeh: {
    keywords: ["bak kut teh", "bkt", "pork rib"],
    category: "Soup",
    items: [
      { itemName: "Bak Kut Teh (Pork Rib Soup)", price: 6.5, description: "Contains: pork ribs, peppercorn, garlic, herbal broth" },
      { itemName: "Bak Kut Teh with You Tiao", price: 8.0, description: "Contains: pork ribs, herbal broth, fried dough fritter" },
      { itemName: "Bak Kut Teh (Large Pot, Sharing)", price: 18.0, description: "Contains: pork ribs, peppercorn, herbal broth, serves 2-3" },
      { itemName: "Herbal Bak Kut Teh", price: 7.0, description: "Contains: pork ribs, angelica root, goji berries, herbal broth" },
      { itemName: "Braised Pig Trotter", price: 6.0, description: "Contains: pig trotter, dark soy sauce, five-spice" },
      { itemName: "Braised Pork Belly", price: 6.5, description: "Contains: pork belly, dark soy sauce, five-spice, egg" },
      { itemName: "Braised Beancurd Skin", price: 3.0, description: "Contains: beancurd skin, dark soy sauce, five-spice" },
      { itemName: "Salted Vegetables", price: 2.0, description: "Contains: preserved mustard greens, garlic" },
      { itemName: "You Tiao (Fried Dough, Extra)", price: 2.0, description: "Contains: fried dough fritter" },
      { itemName: "Enoki Mushroom (Extra)", price: 2.5, description: "Contains: enoki mushroom, herbal broth" },
      { itemName: "Vegetables (Extra)", price: 2.5, description: "Contains: seasonal vegetables, herbal broth" },
      { itemName: "Steamed White Rice", price: 1.0, description: "Contains: rice" },
      { itemName: "Braised Peanuts (Side)", price: 1.5, description: "Contains: peanuts, star anise" },
      { itemName: "Chinese Tea", price: 1.0, description: "Contains: tieguanyin tea leaves, hot water" },
      { itemName: "Iced Chinese Tea", price: 1.5, description: "Contains: chinese tea leaves, ice" }
    ]
  },
  wontonMee: {
    keywords: ["wonton", "wanton"],
    category: "Noodles",
    items: [
      { itemName: "Wonton Mee (Dry)", price: 4.5, description: "Contains: egg noodles, char siew, wonton dumplings, dark sauce" },
      { itemName: "Wonton Mee (Soup)", price: 4.5, description: "Contains: egg noodles, char siew, wonton dumplings, clear broth" },
      { itemName: "Wonton Mee with Extra Char Siew", price: 6.0, description: "Contains: egg noodles, extra char siew, wonton dumplings" },
      { itemName: "Char Siew Rice", price: 5.0, description: "Contains: rice, char siew, dark soy sauce, cucumber" },
      { itemName: "Char Siew Rice with Roast Duck", price: 6.5, description: "Contains: rice, char siew, roast duck, dark soy sauce" },
      { itemName: "Roast Duck Noodle", price: 5.5, description: "Contains: egg noodles, roast duck, dark sauce" },
      { itemName: "Roast Pork (Sio Bak) Rice", price: 5.5, description: "Contains: rice, crispy roast pork, dark soy sauce" },
      { itemName: "Extra Wonton (6pc)", price: 3.0, description: "Contains: minced pork, prawn, wonton skin" },
      { itemName: "Extra Char Siew (Side)", price: 3.5, description: "Contains: char siew, honey glaze" },
      { itemName: "Fried Wonton (6pc)", price: 3.5, description: "Contains: minced pork, prawn, wonton skin, fried" },
      { itemName: "Braised Mushroom (Side)", price: 2.5, description: "Contains: shiitake mushroom, dark soy sauce" },
      { itemName: "Choy Sum with Oyster Sauce", price: 3.0, description: "Contains: choy sum, oyster sauce, garlic" },
      { itemName: "Iced Chinese Tea", price: 1.2, description: "Contains: chinese tea leaves, ice" },
      { itemName: "Iced Winter Melon Tea", price: 1.5, description: "Contains: winter melon, rock sugar" }
    ]
  },
  satay: {
    keywords: ["satay"],
    category: "Grill",
    items: [
      { itemName: "Chicken Satay (10 sticks)", price: 8.0, description: "Contains: chicken, lemongrass, turmeric, peanut sauce" },
      { itemName: "Mutton Satay (10 sticks)", price: 9.0, description: "Contains: mutton, lemongrass, spices, peanut sauce" },
      { itemName: "Beef Satay (10 sticks)", price: 9.0, description: "Contains: beef, lemongrass, spices, peanut sauce" },
      { itemName: "Chicken Satay (5 sticks)", price: 4.5, description: "Contains: chicken, lemongrass, turmeric, peanut sauce" },
      { itemName: "Mutton Satay (5 sticks)", price: 5.0, description: "Contains: mutton, lemongrass, spices, peanut sauce" },
      { itemName: "Mixed Satay Platter (15 sticks)", price: 13.0, description: "Contains: chicken, mutton, beef satay, peanut sauce" },
      { itemName: "Prawn Satay (5 sticks)", price: 6.0, description: "Contains: prawn, lemongrass, spices, peanut sauce" },
      { itemName: "Ketupat (Rice Cake)", price: 0.8, description: "Contains: compressed rice, banana leaf" },
      { itemName: "Peanut Sauce (Extra)", price: 1.5, description: "Contains: ground peanuts, chilli, sugar, tamarind" },
      { itemName: "Cucumber and Onion (Side)", price: 0.8, description: "Contains: cucumber, onion" },
      { itemName: "Satay Bee Hoon", price: 5.5, description: "Contains: rice vermicelli, peanut gravy, cuttlefish, kangkong" },
      { itemName: "Iced Sugar Cane Juice", price: 2.0, description: "Contains: sugar cane, lime" },
      { itemName: "Iced Barley Water", price: 1.5, description: "Contains: barley, winter melon" },
      { itemName: "100 Plus (Can)", price: 1.8, description: "Contains: carbonated isotonic drink" }
    ]
  },
  curry: {
    keywords: ["curry"],
    category: "Rice",
    items: [
      { itemName: "Fish Head Curry", price: 15.0, description: "Contains: fish head, curry gravy, okra, eggplant, tomato" },
      { itemName: "Fish Head Curry (Large, Sharing)", price: 26.0, description: "Contains: fish head, curry gravy, okra, eggplant, serves 3-4" },
      { itemName: "Chicken Curry Rice", price: 5.5, description: "Contains: rice, chicken curry, potato, coconut milk" },
      { itemName: "Vegetable Curry", price: 3.5, description: "Contains: mixed vegetables, curry gravy, coconut milk" },
      { itemName: "Prawn Curry", price: 6.5, description: "Contains: prawn, curry gravy, coconut milk" },
      { itemName: "Mutton Curry", price: 7.0, description: "Contains: mutton, curry gravy, potato, spices" },
      { itemName: "Fish Curry (Fillet)", price: 6.0, description: "Contains: fish fillet, curry gravy, okra, tomato" },
      { itemName: "Eggplant Curry", price: 3.0, description: "Contains: eggplant, curry gravy, coconut milk" },
      { itemName: "Okra Curry", price: 3.0, description: "Contains: okra, curry gravy, coconut milk" },
      { itemName: "Roti Canai (Side)", price: 1.5, description: "Contains: flour dough, ghee" },
      { itemName: "Papadum (3pc)", price: 1.0, description: "Contains: lentil crisp wafer" },
      { itemName: "Steamed Rice", price: 1.0, description: "Contains: rice" },
      { itemName: "Iced Teh Halia", price: 2.0, description: "Contains: black tea, ginger, condensed milk" },
      { itemName: "Lassi (Plain)", price: 2.2, description: "Contains: yoghurt, sugar" }
    ]
  },
  dimSum: {
    keywords: ["dim sum", "dimsum"],
    category: "Dim Sum",
    items: [
      { itemName: "Har Gow (Prawn Dumpling, 4pc)", price: 4.5, description: "Contains: prawn, wheat starch skin, bamboo shoot" },
      { itemName: "Siew Mai (Pork Dumpling, 4pc)", price: 4.5, description: "Contains: minced pork, prawn, mushroom, wonton skin" },
      { itemName: "Char Siew Bao (2pc)", price: 3.5, description: "Contains: char siew, steamed bun dough" },
      { itemName: "Lo Mai Gai (Glutinous Rice, 2pc)", price: 4.5, description: "Contains: glutinous rice, chicken, mushroom, lotus leaf" },
      { itemName: "Rice Rolls (Cheong Fun)", price: 4.0, description: "Contains: rice flour sheet, soy sauce, sesame" },
      { itemName: "Rice Rolls with Prawn", price: 5.0, description: "Contains: rice flour sheet, prawn, soy sauce" },
      { itemName: "Egg Tart (2pc)", price: 3.0, description: "Contains: egg custard, pastry" },
      { itemName: "Custard Bun (2pc)", price: 3.5, description: "Contains: salted egg custard, steamed bun dough" },
      { itemName: "Spring Roll (3pc)", price: 3.5, description: "Contains: vegetables, spring roll skin, fried" },
      { itemName: "Turnip Cake (Pan Fried, 3pc)", price: 4.0, description: "Contains: radish cake, dried shrimp, mushroom" },
      { itemName: "Chicken Feet (Black Bean Sauce)", price: 4.5, description: "Contains: chicken feet, black bean sauce, chilli" },
      { itemName: "Beef Balls (4pc)", price: 4.5, description: "Contains: minced beef, water chestnut, bean curd skin" },
      { itemName: "Century Egg Congee", price: 4.0, description: "Contains: rice congee, century egg, shredded pork" },
      { itemName: "Fried Dough Stick with Rice Roll", price: 4.0, description: "Contains: fried dough stick, rice roll, soy sauce" },
      { itemName: "Chinese Tea", price: 1.0, description: "Contains: pu-erh tea leaves, hot water" },
      { itemName: "Chrysanthemum Tea", price: 1.2, description: "Contains: chrysanthemum flower, hot water" }
    ]
  },
  western: {
    keywords: ["western", "chop", "steak", "fish and chip"],
    category: "Western",
    items: [
      { itemName: "Chicken Chop", price: 8.5, description: "Contains: chicken thigh, black pepper sauce, fries, coleslaw" },
      { itemName: "Grilled Chicken Chop", price: 9.0, description: "Contains: chicken breast, mushroom sauce, fries" },
      { itemName: "Fish and Chips", price: 8.5, description: "Contains: battered fish fillet, fries, tartar sauce" },
      { itemName: "Fish Burger", price: 6.5, description: "Contains: fish fillet, burger bun, lettuce, tartar sauce" },
      { itemName: "Pork Chop", price: 9.5, description: "Contains: pork loin, brown sauce, fries, baked beans" },
      { itemName: "Sirloin Steak", price: 14.0, description: "Contains: sirloin beef, black pepper sauce, fries" },
      { itemName: "Chicken Cutlet Burger", price: 6.0, description: "Contains: fried chicken cutlet, burger bun, lettuce, mayo" },
      { itemName: "Beef Burger", price: 7.0, description: "Contains: beef patty, burger bun, cheese, lettuce" },
      { itemName: "Grilled Lamb Chop", price: 13.0, description: "Contains: lamb chop, mint sauce, fries" },
      { itemName: "Baked Rice with Chicken Chop", price: 9.0, description: "Contains: rice, cheese, chicken chop, tomato sauce" },
      { itemName: "Spaghetti Bolognese", price: 7.5, description: "Contains: spaghetti, minced meat, tomato sauce, parmesan" },
      { itemName: "Carbonara Pasta", price: 8.0, description: "Contains: pasta, cream sauce, bacon, egg" },
      { itemName: "Onion Rings (Side)", price: 3.0, description: "Contains: onion, batter" },
      { itemName: "Coleslaw (Side)", price: 2.0, description: "Contains: cabbage, carrot, mayo" },
      { itemName: "Iced Lemonade", price: 2.5, description: "Contains: lemon juice, sugar syrup, soda water" },
      { itemName: "Root Beer Float", price: 3.5, description: "Contains: root beer, vanilla ice cream" }
    ]
  },
  desserts: {
    keywords: ["dessert", "chendol", "ice kacang", "tau huay", "tofu", "sweet"],
    category: "Desserts",
    items: [
      { itemName: "Chendol", price: 3.0, description: "Contains: shaved ice, coconut milk, gula melaka, green rice jelly, red beans" },
      { itemName: "Chendol with Durian", price: 4.5, description: "Contains: shaved ice, coconut milk, gula melaka, durian, green rice jelly" },
      { itemName: "Ice Kacang", price: 3.0, description: "Contains: shaved ice, red beans, attap chee, sweet corn, syrup" },
      { itemName: "Tau Huay (Soft Beancurd)", price: 2.0, description: "Contains: soybean curd, sugar syrup" },
      { itemName: "Tau Huay with Ginkgo", price: 2.5, description: "Contains: soybean curd, ginkgo nut, sugar syrup" },
      { itemName: "Soya Bean Milk", price: 1.5, description: "Contains: soybean, sugar" },
      { itemName: "Bo Bo Cha Cha", price: 3.0, description: "Contains: sweet potato, taro, sago, coconut milk" },
      { itemName: "Sweet Potato Soup (Orh Nee Style)", price: 2.5, description: "Contains: sweet potato, ginger, sugar" },
      { itemName: "Yam Paste (Orh Nee)", price: 3.5, description: "Contains: mashed yam, gingko nut, pumpkin, coconut milk" },
      { itemName: "Red Bean Soup", price: 2.0, description: "Contains: red bean, sugar, lotus seed" },
      { itemName: "Green Bean Soup", price: 2.0, description: "Contains: green bean, sugar, pandan" },
      { itemName: "Grass Jelly Drink", price: 1.8, description: "Contains: grass jelly, sugar syrup, ice" },
      { itemName: "Durian Pengat", price: 4.0, description: "Contains: durian, coconut milk, sago, sugar" },
      { itemName: "Mango Sago Pomelo", price: 3.5, description: "Contains: mango, sago, pomelo, coconut milk" },
      { itemName: "Peanut Soup (Tong Sui)", price: 2.5, description: "Contains: peanuts, sugar" },
      { itemName: "Apom Balik (Peanut Pancake)", price: 1.5, description: "Contains: flour batter, peanuts, sugar, corn" }
    ]
  },
  drinks: {
    keywords: ["drink", "juice", "kopi", "coffee", "beverage"],
    category: "Drinks",
    items: [
      { itemName: "Kopi (Coffee with Condensed Milk)", price: 1.6, description: "Contains: coffee, condensed milk" },
      { itemName: "Kopi-O (Black Coffee)", price: 1.4, description: "Contains: coffee, sugar" },
      { itemName: "Kopi-C (Coffee with Evaporated Milk)", price: 1.6, description: "Contains: coffee, evaporated milk, sugar" },
      { itemName: "Kopi Peng (Iced Coffee)", price: 2.0, description: "Contains: coffee, condensed milk, ice" },
      { itemName: "Teh (Tea with Condensed Milk)", price: 1.6, description: "Contains: black tea, condensed milk" },
      { itemName: "Teh-O (Black Tea)", price: 1.4, description: "Contains: black tea, sugar" },
      { itemName: "Teh Peng (Iced Milk Tea)", price: 2.0, description: "Contains: black tea, condensed milk, ice" },
      { itemName: "Teh Tarik", price: 2.0, description: "Contains: black tea, condensed milk, evaporated milk" },
      { itemName: "Milo (Hot)", price: 1.8, description: "Contains: milo powder, milk" },
      { itemName: "Iced Milo", price: 2.0, description: "Contains: milo powder, milk, ice" },
      { itemName: "Milo Dinosaur", price: 3.0, description: "Contains: milo powder, milk, extra milo powder topping" },
      { itemName: "Fresh Orange Juice", price: 2.8, description: "Contains: fresh oranges" },
      { itemName: "Watermelon Juice", price: 2.5, description: "Contains: fresh watermelon" },
      { itemName: "Sugar Cane Juice", price: 2.0, description: "Contains: sugar cane, lime" },
      { itemName: "Soda Bottle", price: 1.5, description: "Contains: carbonated soft drink" },
      { itemName: "Bandung (Rose Milk)", price: 1.8, description: "Contains: rose syrup, condensed milk, water" },
      { itemName: "Barley Water", price: 1.5, description: "Contains: barley, water" },
      { itemName: "Chrysanthemum Tea (Can)", price: 1.8, description: "Contains: chrysanthemum, sugar" }
    ]
  },
  economyRice: {
    keywords: ["economy rice", "cai png", "mixed rice", "zi char"],
    category: "Rice",
    items: [
      { itemName: "1 Meat 2 Vegetables Rice", price: 4.5, description: "Contains: rice, choice of meat, two vegetable dishes" },
      { itemName: "2 Meat 1 Vegetable Rice", price: 5.5, description: "Contains: rice, two meat dishes, one vegetable dish" },
      { itemName: "3 Meat Rice", price: 6.5, description: "Contains: rice, three meat dishes" },
      { itemName: "Vegetarian Rice (3 Vegetables)", price: 3.5, description: "Contains: rice, three vegetable dishes" },
      { itemName: "Sweet and Sour Pork", price: 3.5, description: "Contains: pork, pineapple, bell pepper, sweet sour sauce" },
      { itemName: "Braised Tofu with Egg", price: 2.5, description: "Contains: tofu, egg, soy sauce, spring onion" },
      { itemName: "Stir-fried Cabbage", price: 2.0, description: "Contains: cabbage, garlic, dried shrimp" },
      { itemName: "Curry Chicken", price: 3.5, description: "Contains: chicken, curry gravy, potato" },
      { itemName: "Sambal Kang Kong", price: 2.5, description: "Contains: kangkong, sambal chilli, belacan" },
      { itemName: "Steamed Egg", price: 2.0, description: "Contains: egg, soy sauce" },
      { itemName: "Fried Fish (Assorted)", price: 3.5, description: "Contains: fish fillet, turmeric batter" },
      { itemName: "Braised Pork Belly", price: 3.5, description: "Contains: pork belly, dark soy sauce" },
      { itemName: "Ngoh Hiang (Fried Meat Roll)", price: 2.5, description: "Contains: minced pork, prawn, bean curd skin" },
      { itemName: "Luncheon Meat (Fried)", price: 2.0, description: "Contains: luncheon meat" },
      { itemName: "Fried Egg", price: 1.5, description: "Contains: egg" },
      { itemName: "Iced Barley", price: 1.5, description: "Contains: barley, winter melon" },
      { itemName: "Chinese Tea", price: 1.0, description: "Contains: tea leaves, hot water" }
    ]
  }
};

// Used when the stall name doesn't match any category above for like a generic one
// mixed hawker selection so every stall still gets a reasonable starter menu.
const GENERIC_POOL = [
  { itemName: "Signature Fried Rice", price: 4.5, category: "Rice", description: "Contains: rice, egg, mixed vegetables, soy sauce" },
  { itemName: "House Special Noodles", price: 5.0, category: "Noodles", description: "Contains: noodles, mixed vegetables, choice of protein" },
  { itemName: "Grilled Chicken Skewers (3pc)", price: 4.0, category: "Grill", description: "Contains: chicken, house marinade" },
  { itemName: "Grilled Fish Skewers (3pc)", price: 4.5, category: "Grill", description: "Contains: fish, house marinade" },
  { itemName: "Mixed Vegetables", price: 2.5, category: "Sides", description: "Contains: seasonal greens, garlic" },
  { itemName: "Soup of the Day", price: 3.0, category: "Soup", description: "Contains: seasonal broth, vegetables" },
  { itemName: "Spring Rolls (4pc)", price: 3.0, category: "Sides", description: "Contains: vegetables, spring roll skin" },
  { itemName: "Fried Wanton (4pc)", price: 3.0, category: "Sides", description: "Contains: minced pork, prawn, wonton skin" },
  { itemName: "Stir-fried Beehoon", price: 4.0, category: "Noodles", description: "Contains: rice vermicelli, egg, mixed vegetables" },
  { itemName: "House Salad", price: 3.5, category: "Sides", description: "Contains: mixed greens, house dressing" },
  { itemName: "Grilled Corn", price: 2.0, category: "Sides", description: "Contains: corn, butter" },
  { itemName: "Iced Lemon Tea", price: 1.8, category: "Drinks", description: "Contains: black tea, lemon, sugar syrup" },
  { itemName: "Iced Milo", price: 2.0, category: "Drinks", description: "Contains: milo powder, milk, ice" },
  { itemName: "Chilled Soursop Juice", price: 2.5, category: "Drinks", description: "Contains: soursop fruit, sugar syrup" },
  { itemName: "Kopi", price: 1.6, category: "Drinks", description: "Contains: coffee, condensed milk" },
  { itemName: "Homemade Chilli Sauce (Side)", price: 0.5, category: "Sides", description: "Contains: chilli, garlic, vinegar" },
  { itemName: "Steamed White Rice", price: 1.0, category: "Rice", description: "Contains: rice" },
  { itemName: "Fried Egg", price: 1.0, category: "Sides", description: "Contains: egg, cooking oil" },
  { itemName: "Papadum (Side)", price: 1.0, category: "Sides", description: "Contains: lentil crisp wafer" },
  { itemName: "Tofu Soup", price: 2.5, category: "Soup", description: "Contains: tofu, vegetables, broth" }
];

function pickTemplate(stallName, cuisineType) {
  const name = (stallName || "").toLowerCase();
  const cuisine = (cuisineType || "").toLowerCase();

  for (const key of Object.keys(TEMPLATES)) {
    const tpl = TEMPLATES[key];
    if (tpl.keywords.some(k => name.includes(k) || cuisine.includes(k))) {
      return tpl;
    }
  }
  return null;
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Slightly varies a price so repeated stalls of the same type don't look identical
function jitterPrice(price) {
  const delta = (Math.random() * 0.8 - 0.4); // +/- $0.40
  return Math.max(0.5, Math.round((price + delta) * 20) / 20); // round to nearest 5 cents
}

// Creates a menu for a new stall.
// The system uses menu items from the closest matching cuisine.
// If there are not enough items, it adds common menu items.
// This makes sure every new stall starts with a complete menu.
function generateMenuForStall(stallName, cuisineType) {
  const matched = pickTemplate(stallName, cuisineType);

  let pool;
  let defaultCategory;
  if (matched) {
    pool = matched.items.map(item => ({ ...item, category: matched.category }));
    defaultCategory = matched.category;
  } else {
    pool = GENERIC_POOL;
    defaultCategory = "Sides";
  }

  // Always include every item from the matched pool at least once; if that's
  // still short of the target count, top up with (non-duplicate) generic items.
  const target = Math.min(pool.length + GENERIC_POOL.length, 40 + Math.floor(Math.random() * 21)); // 40-60
  let selection = pool.slice();

  if (selection.length < target) {
    const extra = shuffle(GENERIC_POOL).filter(g => !selection.some(p => p.itemName === g.itemName));
    selection = selection.concat(extra);
  }

  selection = shuffle(selection).slice(0, target);

  return selection.map(item => ({
    itemName: item.itemName,
    price: jitterPrice(item.price),
    category: item.category || defaultCategory,
    description: item.description
  }));
}

module.exports = { generateMenuForStall };
