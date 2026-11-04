(function (global) {
  "use strict";

  var NAMES = {
    B: { adj: ["Browsing"],
         nouns: ["Baboon", "Badger", "Barnacle", "Barracuda", "Bat", "Bear", "Beaver", "Bee", "Beetle", "Binturong", "Bearcat", "Bird", "Bison", "Bobcat", "Bonobo", "Buffalo", "Bull", "Bumblebee", "Butterfly"] },
    H: { adj: ["Hungry"],
         nouns: ["Hamster", "Hare", "Hawk", "Hawkfish", "Hedgehog", "Heron", "Herring", "Hippo", "Honeybee", "Horse", "Hummingbird", "Hyena"] },
    J: { adj: ["Juicy"],
         nouns: ["Joey", "Jalapeño"] },
    W: { adj: ["Wandering"],
         nouns: ["Wallaby", "Walrus", "Weasel", "Whippet", "Wolf", "Wolverine", "Wombat", "Woodpecker", "Worm"] }
  };

  global.HAWKR_GUEST_NAMES = NAMES;
})(window);
