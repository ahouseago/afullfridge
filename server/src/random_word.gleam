import gleam/list
import gleam/result

const random_words = [
  "A full fridge", "Skiing", "Tobogganing", "Pineapple", "Climbing", "Christmas",
  "Costa Rica", "Potatoes", "Brexit", "Crisps", "Chips", "Swimming",
  "Having a hot bath", "The relief when the toilet flushes on the second try",
  "Garlic", "Mobile phones", "Health", "Sleep", "Children", "Pets", "Dogs",
  "Freedom", "Fresh air on a hot day", "Having wet socks", "Working from home",
  "A smelly colleague", "When you are really cold and hold a warm mug",
  "Hot water bottle", "Getting a bad hair cut", "Squirrels", "Bread",
  "A fresh mojito", "Chinese food", "China", "Gangnam style", "Church bells",
  "Doritos", "Hygge", "Sugar", "Clean pyjamas, sheets, the whole deal", "Racism",
  "War", "Water dribbling down your arm when brushing your teeth",
  "The terminator", "Eyelashes", "Teeth", "Captions", "Red wine", "Bubbles",
  "Noses", "Morbid curiosity", "Poems", "The classics", "Wine", "A full fridge",
  "Freshly baked bread", "The smell of rain on tarmac",
  "The whimsy of a boiled egg", "Veganism", "Good pastry", "Cheese",
  "Drying after showering when it's really cold",
  "Getting in a cold bed that feels like it might be wet",
  "Getting into a bed that someone's been warming up", "Maltesers",
  "Blowing maltesers", "Big hair", "Leffe", "Nicknames from school", "Thai food",
  "Catcher in the Rye", "Game of Thrones", "Jaime lanister", "Pedro Pascal",
  "Glasses", "Schadenfreude", "Germany", "Football", "Good speakers",
  "Muscle men", "Female singers", "Male singers", "Elderflower", "Elvis",
  "Foxglove", "Ink", "Technology", "The Fresh Prince of Bel-air", "Minecraft",
  "Wigs", "Tadpoles", "Tax rebates", "Private school", "Tooth ache",
  "Candle wax", "Lightbulbs", "Crochet", "Vanilla", "Marriage", "Freddy Mercury",
  "Taylor Swift", "The Killers", "Stealing from work", "Ice cream", "Coffee",
  "Tea", "Flowers", "Music", "Mice", "Television", "The cold side of the pillow",
]

pub fn new() {
  list.shuffle(random_words) |> list.first |> result.unwrap("This game")
}
