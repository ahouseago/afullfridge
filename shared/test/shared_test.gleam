import gleam/json
import gleam/option.{None}
import gleeunit
import gleeunit/should
import shared.{Player, PlayerId, PlayerName, Room, RoomCode}

pub fn main() {
  gleeunit.main()
}

pub fn player_from_json_test() {
  "{\"id\": \"99\", \"name\": \"alex\"}"
  |> json.decode(shared.player_from_json)
  |> should.equal(Ok(Player(id: PlayerId("99"), name: PlayerName("alex"))))
}

pub fn room_from_json_test() {
  "
  {
    \"roomCode\": \"abcd\",
    \"players\": [{\"name\": \"bartholemew\", \"id\": \"12\"}, {\"name\": \"susan\", \"id\": \"26\"}],
    \"wordList\": [\"sand\", \"squirrels\", \"wild swimming\"],
    \"finishedRounds\": [],
    \"scoringMethod\": \"SMART\"
  }
  "
  |> json.decode(shared.room_from_json)
  |> should.equal(
    Ok(Room(
      room_code: RoomCode("abcd"),
      players: [
        Player(name: PlayerName("bartholemew"), id: PlayerId("12")),
        Player(name: PlayerName("susan"), id: PlayerId("26")),
      ],
      word_list: ["sand", "squirrels", "wild swimming"],
      round: None,
      finished_rounds: [],
      scoring_method: shared.Smart,
    )),
  )
}
