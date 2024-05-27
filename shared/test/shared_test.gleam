import gleam/dict
import gleam/json
import gleam/option.{None}
import gleeunit
import gleeunit/should
import shared.{Player, Room}

pub fn main() {
  gleeunit.main()
}

pub fn player_from_json_test() {
  "{\"id\": 99, \"name\": \"alex\"}"
  |> json.decode(shared.player_from_json)
  |> should.equal(Ok(Player(id: 99, name: "alex")))
}

pub fn room_from_json_test() {
  "
  {
    \"roomCode\": \"abcd\",
    \"players\": [{\"name\": \"bartholemew\", \"id\": 12}, {\"name\": \"susan\", \"id\": 26}],
    \"wordList\": [\"sand\", \"squirrels\", \"wild swimming\"]
  }
  "
  |> json.decode(shared.room_from_json)
  |> should.equal(
    Ok(Room(
      room_code: "abcd",
      players: dict.new()
        |> dict.insert(12, Player(name: "bartholemew", id: 12))
        |> dict.insert(26, Player(name: "susan", id: 26)),
      word_list: ["sand", "squirrels", "wild swimming"],
      round: None,
    )),
  )
}
