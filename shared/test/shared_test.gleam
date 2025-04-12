import gleam/json
import gleam/option.{None}
import gleeunit
import gleeunit/should
import shared.{Player, PlayerId, PlayerName, Room, RoomCode}

pub fn main() {
  gleeunit.main()
}

pub fn player_from_json_test() {
  "{\"id\": \"99\", \"name\": \"alex\", \"connected\": false}"
  |> json.decode(shared.player_from_json)
  |> should.equal(
    Ok(Player(id: PlayerId("99"), name: PlayerName("alex"), connected: False)),
  )
}

pub fn room_from_json_test() {
  "
  {
    \"roomCode\": \"abcd\",
    \"players\": [{\"name\": \"bartholemew\", \"id\": \"12\", \"connected\": true}, {\"name\": \"susan\", \"id\": \"26\", \"connected\": false}],
    \"wordList\": [\"sand\", \"squirrels\", \"wild swimming\"],
    \"round\": null,
    \"finishedRounds\": [],
    \"scoringMethod\": \"SMART\"
  }
  "
  |> json.decode(shared.room_from_json)
  |> should.equal(
    Ok(Room(
      room_code: RoomCode("abcd"),
      players: [
        Player(
          name: PlayerName("bartholemew"),
          id: PlayerId("12"),
          connected: True,
        ),
        Player(name: PlayerName("susan"), id: PlayerId("26"), connected: False),
      ],
      word_list: ["sand", "squirrels", "wild swimming"],
      round: None,
      finished_rounds: [],
      scoring_method: shared.Smart,
    )),
  )
}

pub fn room_from_json_again_test() {
  "
  {
    \"roomCode\":\"ZSRU\",
    \"players\":[{\"id\":\"0\", \"name\":\"alex\", \"connected\": true}],
    \"wordList\":[],
    \"round\":null,
    \"finishedRounds\":[],
    \"scoringMethod\":\"SMART\"
  }
  "
  |> json.decode(shared.room_from_json)
  |> should.equal(
    Ok(Room(
      room_code: RoomCode("ZSRU"),
      players: [
        Player(name: PlayerName("alex"), id: PlayerId("0"), connected: True),
      ],
      word_list: [],
      round: None,
      finished_rounds: [],
      scoring_method: shared.Smart,
    )),
  )
}
