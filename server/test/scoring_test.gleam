import internal/scoring.{ordered_pairs}
import gleeunit
import gleeunit/should

pub fn main() {
  gleeunit.main()
}

pub fn ordered_pairs_scoring_exact_match_test() {
  ordered_pairs([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]) |> should.equal(4)
}

pub fn ordered_pairs_scoring_three_matching_test() {
  ordered_pairs([1, 2, 3, 4, 5], [1, 3, 2, 4, 5]) |> should.equal(3)
  ordered_pairs([1, 2, 3, 4, 5], [4, 5, 1, 2, 3]) |> should.equal(3)
}

pub fn ordered_pairs_scoring_no_matching() {
  ordered_pairs([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]) |> should.equal(0)
}
