import gleam/json
import gleam/option.{None}
import gleeunit
import gleeunit/should
import shared.{Player, Room}

pub fn main() {
  gleeunit.main()
}

pub fn player_from_json_test() {
  "{\"id\": \"99\", \"name\": \"alex\", \"connected\": false}"
  |> json.parse(shared.player_decoder())
  |> should.equal(
    Ok(Player(id: shared.id_from_string("99"), name: "alex", connected: False)),
  )
}

pub fn room_from_json_test() {
  "
  {
    \"room_code\": \"abcd\",
    \"players\": [{\"name\": \"bartholemew\", \"id\": \"12\", \"connected\": true}, {\"name\": \"susan\", \"id\": \"26\", \"connected\": false}],
    \"word_list\": [\"sand\", \"squirrels\", \"wild swimming\"],
    \"round\": null,
    \"finished_rounds\": [],
    \"scoring_method\": \"smart\"
  }
  "
  |> json.parse(shared.room_decoder())
  |> should.equal(
    Ok(Room(
      room_code: shared.id_from_string("abcd"),
      players: [
        Player(
          name: "bartholemew",
          id: shared.id_from_string("12"),
          connected: True,
        ),
        Player(name: "susan", id: shared.id_from_string("26"), connected: False),
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
    \"room_code\":\"ZSRU\",
    \"players\":[{\"id\":\"0\", \"name\":\"alex\", \"connected\": true}],
    \"word_list\":[],
    \"round\":null,
    \"finished_rounds\":[],
    \"scoring_method\":\"smart\"
  }
  "
  |> json.parse(shared.room_decoder())
  |> should.equal(
    Ok(Room(
      room_code: shared.id_from_string("ZSRU"),
      players: [
        Player(name: "alex", id: shared.id_from_string("0"), connected: True),
      ],
      word_list: [],
      round: None,
      finished_rounds: [],
      scoring_method: shared.Smart,
    )),
  )
}
