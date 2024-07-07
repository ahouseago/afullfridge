import gleam/list

/// exact_match scores one point if the lists exactly match, zero otherwise.
pub fn exact_match(correct_word_list, word_list) {
  case word_list == correct_word_list {
    True -> 1
    False -> 0
  }
}

/// equal_position scores a point for every entry that is in the same position
/// in the correct word list.
pub fn equal_position(
  correct_word_list: List(String),
  word_list: List(String),
) -> Int {
  list.zip(correct_word_list, word_list)
  |> list.fold(0, fn(score, items) {
    case items.0 == items.1 {
      True -> score + 1
      False -> score
    }
  })
}

/// ordered_pairs returns the number of pairs in the word list that are
/// ordered correctly based on the ordering of the correct word list.
pub fn ordered_pairs(correct_word_list, word_list) -> Int {
  let correct_permutations = list.combination_pairs(correct_word_list)
  let permutations = list.window_by_2(word_list)

  list.fold(permutations, 0, fn(score, pair) {
    case list.contains(correct_permutations, pair) {
      True -> score + 1
      False -> score
    }
  })
}

/// Smart scoring adds the points from equal positions to 1 point for each
/// pair of words that are ordered correctly, starting from a score of -1 to
/// make the numbers nicer.
pub fn smart(
  correct_word_list: List(String),
  word_list: List(String),
) -> Int {
  let equal_position_score =
    equal_position(correct_word_list, word_list)
  let ordered_pairs_score = ordered_pairs(correct_word_list, word_list)

  equal_position_score + ordered_pairs_score - 1
}
