import gleam/dynamic
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/pair
import gleam/result

pub type PlayerName =
  String

pub type PlayerId =
  String

pub type RoomCode =
  String

pub type HttpRequest {
  CreateRoomRequest
  JoinRoomRequest(room_code: RoomCode)
}

pub type HttpResponse {
  // Returned from successfully creating/joining a room.
  RoomResponse(room_code: RoomCode, player_id: PlayerId)
}

pub type WebsocketRequest {
  AddWord(String)
  AddRandomWord
  RemoveWord(String)
  ListWords
  StartRound
  SubmitOrderedWords(List(String))
}

pub type WebsocketResponse {
  // Sent after connecting to a room.
  InitialRoomState(Room)
  PlayersInRoom(List(Player))
  WordList(List(String))
  RoundInfo(Round)
  RoundResult(FinishedRound)
  ServerError(reason: String)
}

pub type Player {
  Player(id: PlayerId, name: PlayerName)
}

fn player_to_json(player: Player) {
  json.object([
    #("id", json.string(player.id)),
    #("name", json.string(player.name)),
  ])
}

pub fn player_from_json(
  player: dynamic.Dynamic,
) -> Result(Player, List(dynamic.DecodeError)) {
  player
  |> dynamic.decode2(
    Player,
    dynamic.field("id", dynamic.string),
    dynamic.field("name", dynamic.string),
  )
}

pub type PlayerWithOrderedPreferences =
  #(PlayerId, List(String))

// fn player_with_preferences_to_json(p: PlayerWithOrderedPreferences) {
//   json.object([
//     #("playerId", json.string(p.0)),
//     #("wordOrder", json.array(p.1, of: json.string)),
//   ])
// }
//
// fn player_with_preferences_from_json(
//   player_with_prefs: dynamic.Dynamic,
// ) -> Result(PlayerWithOrderedPreferences, List(dynamic.DecodeError)) {
//   player_with_prefs
//   |> dynamic.decode2(
//     fn(player_id, prefs) { #(player_id, prefs) },
//     dynamic.field("playerId", dynamic.string),
//     dynamic.field("wordOrder", dynamic.list(dynamic.string)),
//   )
// }
//
// fn scores_to_json(p: #(PlayerId, Int)) {
//   json.object([#("playerId", json.string(p.0)), #("score", json.int(p.1))])
// }
//
// fn scores_from_json(
//   p: dynamic.Dynamic,
// ) -> Result(#(PlayerId, Int), List(dynamic.DecodeError)) {
//   p
//   |> dynamic.decode2(
//     fn(player_id, score) { #(player_id, score) },
//     dynamic.field("playerId", dynamic.string),
//     dynamic.field("score", dynamic.int),
//   )
// }

/// Round represents a round of the game within a room, where one player is
/// selecting their order of preferences out of some given list of words, and the
/// other players are trying to guess that ordering.
pub type Round {
  Round(
    words: List(String),
    // The player who everyone is trying to guess the preference order of.
    leading_player_id: PlayerId,
    // The other players who have submitted.
    submitted: List(PlayerId),
  )
}

pub fn round_to_json(round: Round) -> json.Json {
  json.object([
    #("words", json.array(round.words, of: json.string)),
    #("leadingPlayerId", json.string(round.leading_player_id)),
    #("submitted", json.array(round.submitted, of: json.string)),
  ])
}

pub fn round_from_json(
  round: dynamic.Dynamic,
) -> Result(Round, List(dynamic.DecodeError)) {
  round
  |> dynamic.decode3(
    Round,
    dynamic.field("words", dynamic.list(dynamic.string)),
    dynamic.field("leadingPlayerId", dynamic.string),
    dynamic.field("submitted", dynamic.list(dynamic.string)),
  )
}

pub type FinishedRound {
  FinishedRound(
    words: List(String),
    leading_player_id: PlayerId,
    player_scores: List(PlayerScore),
  )
}

pub fn finished_round_to_json(round: FinishedRound) -> json.Json {
  json.object([
    #("words", json.array(round.words, of: json.string)),
    #("leadingPlayerId", json.string(round.leading_player_id)),
    #("scores", json.array(round.player_scores, of: player_score_to_json)),
  ])
}

pub fn finished_round_from_json(
  round: dynamic.Dynamic,
) -> Result(FinishedRound, List(dynamic.DecodeError)) {
  round
  |> dynamic.decode3(
    FinishedRound,
    dynamic.field("words", dynamic.list(dynamic.string)),
    dynamic.field("leadingPlayerId", dynamic.string),
    dynamic.field("scores", dynamic.list(player_score_from_json)),
  )
}

pub type PlayerScore {
  PlayerScore(player: Player, words: List(String), score: Int)
}

pub fn player_score_to_json(player_score: PlayerScore) -> json.Json {
  json.object([
    #("player", player_to_json(player_score.player)),
    #("words", json.array(player_score.words, of: json.string)),
    #("score", json.int(player_score.score)),
  ])
}

pub fn player_score_from_json(
  player_score: dynamic.Dynamic,
) -> Result(PlayerScore, List(dynamic.DecodeError)) {
  player_score
  |> dynamic.decode3(
    PlayerScore,
    dynamic.field("player", player_from_json),
    dynamic.field("words", dynamic.list(dynamic.string)),
    dynamic.field("score", dynamic.int),
  )
}

pub type Room {
  Room(
    room_code: RoomCode,
    players: List(Player),
    // All of the words that can be chosen from to create a round.
    word_list: List(String),
    round: Option(Round),
    finished_rounds: List(FinishedRound),
  )
}

pub fn room_to_json(room: Room) -> json.Json {
  json.object([
    #("roomCode", json.string(room.room_code)),
    #("players", json.array(room.players, of: player_to_json)),
    #("wordList", json.array(room.word_list, of: json.string)),
    #("round", json.nullable(room.round, of: round_to_json)),
    #(
      "finishedRounds",
      json.array(room.finished_rounds, of: finished_round_to_json),
    ),
  ])
}

pub fn room_from_json(
  room: dynamic.Dynamic,
) -> Result(Room, List(dynamic.DecodeError)) {
  room
  |> dynamic.decode5(
    Room,
    dynamic.field("roomCode", dynamic.string),
    dynamic.field("players", dynamic.list(player_from_json)),
    dynamic.field("wordList", dynamic.list(dynamic.string)),
    dynamic.optional_field("round", round_from_json),
    dynamic.field("finishedRounds", dynamic.list(finished_round_from_json)),
  )
}

pub fn encode_http_request(request: HttpRequest) {
  let #(t, message) =
    case request {
      CreateRoomRequest -> #("createRoom", json.null())
      JoinRoomRequest(room_code) -> #("joinRoom", json.string(room_code))
    }
    |> pair.map_first(json.string)
  json.object([#("type", t), #("message", message)])
}

pub fn encode_request(request: WebsocketRequest) {
  let #(t, message) =
    case request {
      AddWord(word) -> #("addWord", json.string(word))
      AddRandomWord -> #("addRandomWord", json.null())
      RemoveWord(word) -> #("removeWord", json.string(word))
      ListWords -> #("listWords", json.null())
      StartRound -> #("startRound", json.null())
      SubmitOrderedWords(ordered_words) -> #(
        "submitOrderedWords",
        json.array(from: ordered_words, of: json.string),
      )
    }
    |> pair.map_first(json.string)
  json.object([#("type", t), #("message", message)])
  |> json.to_string
}

pub fn decode_http_request(request: String) -> Result(HttpRequest, String) {
  let type_decoder =
    dynamic.decode2(
      fn(t, msg) { #(t, msg) },
      dynamic.field("type", dynamic.string),
      dynamic.field("message", dynamic.dynamic),
    )
  let request_with_type = json.decode(request, type_decoder)

  case request_with_type {
    Ok(#("createRoom", _)) -> Ok(CreateRoomRequest)
    Ok(#("joinRoom", msg)) ->
      msg
      |> dynamic.decode1(JoinRoomRequest, dynamic.string)
    Ok(#(request_type, _)) ->
      Error([dynamic.DecodeError("unknown request type", request_type, [])])
    Error(json.UnexpectedFormat(e)) -> Error(e)
    Error(json.UnexpectedByte(byte, _))
    | Error(json.UnexpectedSequence(byte, _)) ->
      Error([dynamic.DecodeError("invalid request", byte, [])])
    Error(json.UnexpectedEndOfInput) ->
      Error([
        dynamic.DecodeError("bad request: unexpected end of input", "", []),
      ])
  }
  |> result.map_error(decode_errs_to_string)
}

pub fn decode_websocket_request(
  text: String,
) -> Result(WebsocketRequest, String) {
  let type_decoder =
    dynamic.decode2(
      fn(t, msg) { #(t, msg) },
      dynamic.field("type", dynamic.string),
      dynamic.field("message", dynamic.dynamic),
    )
  let request_with_type = json.decode(text, type_decoder)

  case request_with_type {
    Ok(#("addWord", msg)) ->
      msg
      |> dynamic.decode1(AddWord, dynamic.string)
    Ok(#("addRandomWord", _)) -> Ok(AddRandomWord)
    Ok(#("removeWord", msg)) ->
      msg |> dynamic.decode1(RemoveWord, dynamic.string)
    Ok(#("listWords", _)) -> Ok(ListWords)
    Ok(#("startRound", _)) -> Ok(StartRound)
    Ok(#("submitOrderedWords", msg)) ->
      msg
      |> dynamic.decode1(SubmitOrderedWords, dynamic.list(of: dynamic.string))
    Ok(#(request_type, _)) ->
      Error([dynamic.DecodeError("unknown request type", request_type, [])])
    Error(json.UnexpectedFormat(e)) -> Error(e)
    Error(json.UnexpectedByte(byte, _))
    | Error(json.UnexpectedSequence(byte, _)) ->
      Error([dynamic.DecodeError("invalid request", byte, [])])
    Error(json.UnexpectedEndOfInput) ->
      Error([
        dynamic.DecodeError("bad request: unexpected end of input", "", []),
      ])
  }
  |> result.map_error(decode_errs_to_string)
}

pub fn encode_http_response(response: HttpResponse) {
  let #(t, message) =
    case response {
      RoomResponse(room_code, player_id) -> #(
        "joinedRoom",
        json.object([
          #("roomCode", json.string(room_code)),
          #("playerId", json.string(player_id)),
        ]),
      )
    }
    |> pair.map_first(json.string)
  json.object([#("type", t), #("message", message)])
  |> json.to_string
}

pub fn encode_websocket_response(response: WebsocketResponse) {
  let #(t, message) =
    case response {
      InitialRoomState(room) -> #("room", room_to_json(room))
      PlayersInRoom(players) -> #(
        "playersInRoom",
        json.array(from: players, of: player_to_json),
      )
      WordList(word_list) -> #(
        "wordList",
        json.array(from: word_list, of: json.string),
      )
      RoundInfo(round) -> #("roundInfo", round_to_json(round))
      RoundResult(finished_round) -> #(
        "roundResult",
        finished_round_to_json(finished_round),
      )
      ServerError(reason) -> #("error", json.string(reason))
    }
    |> pair.map_first(json.string)
  json.object([#("type", t), #("message", message)])
  |> json.to_string
}

pub fn decode_http_response_json(
  response: dynamic.Dynamic,
) -> Result(HttpResponse, dynamic.DecodeErrors) {
  let type_decoder =
    dynamic.decode2(
      fn(t, msg) { #(t, msg) },
      dynamic.field("type", dynamic.string),
      dynamic.field("message", dynamic.dynamic),
    )
  case type_decoder(response) {
    Ok(#("joinedRoom", msg)) ->
      msg
      |> dynamic.decode2(
        RoomResponse,
        dynamic.field("roomCode", dynamic.string),
        dynamic.field("playerId", dynamic.string),
      )
    Ok(#(request_type, _)) ->
      Error([dynamic.DecodeError("unknown request type", request_type, [])])
    Error(e) -> Error(e)
  }
}

pub fn decode_http_response(request: String) -> Result(HttpResponse, String) {
  let type_decoder =
    dynamic.decode2(
      fn(t, msg) { #(t, msg) },
      dynamic.field("type", dynamic.string),
      dynamic.field("message", dynamic.dynamic),
    )
  let response_with_type = json.decode(request, type_decoder)
  case response_with_type {
    Ok(#("room", msg)) ->
      msg
      |> dynamic.decode2(
        RoomResponse,
        dynamic.field("roomCode", dynamic.string),
        dynamic.field("playerId", dynamic.string),
      )
    Ok(#(request_type, _)) ->
      Error([dynamic.DecodeError("unknown request type", request_type, [])])
    Error(json.UnexpectedFormat(e)) -> Error(e)
    Error(json.UnexpectedByte(byte, _))
    | Error(json.UnexpectedSequence(byte, _)) ->
      Error([dynamic.DecodeError("invalid request", byte, [])])
    Error(json.UnexpectedEndOfInput) ->
      Error([
        dynamic.DecodeError("bad request: unexpected end of input", "", []),
      ])
  }
  |> result.map_error(decode_errs_to_string)
}

pub fn decode_websocket_response(
  text: String,
) -> Result(WebsocketResponse, String) {
  let type_decoder =
    dynamic.decode2(
      fn(t, msg) { #(t, msg) },
      dynamic.field("type", dynamic.string),
      dynamic.field("message", dynamic.dynamic),
    )
  let response_with_type = json.decode(text, type_decoder)

  case response_with_type {
    Ok(#("room", msg)) ->
      msg |> dynamic.decode1(InitialRoomState, room_from_json)
    Ok(#("playersInRoom", msg)) ->
      msg
      |> dynamic.decode1(PlayersInRoom, dynamic.list(of: player_from_json))
    Ok(#("wordList", msg)) ->
      msg
      |> dynamic.decode1(WordList, dynamic.list(of: dynamic.string))
    Ok(#("roundInfo", msg)) ->
      msg
      |> dynamic.decode1(RoundInfo, round_from_json)
    Ok(#("roundResult", msg)) ->
      msg
      |> dynamic.decode1(RoundResult, finished_round_from_json)
    Ok(#("error", msg)) ->
      msg
      |> dynamic.decode1(ServerError, dynamic.string)

    Ok(#(request_type, _)) ->
      Error([dynamic.DecodeError("unknown request type", request_type, [])])
    Error(json.UnexpectedFormat(e)) -> Error(e)
    Error(json.UnexpectedByte(byte, _))
    | Error(json.UnexpectedSequence(byte, _)) ->
      Error([dynamic.DecodeError("invalid request", byte, [])])
    Error(json.UnexpectedEndOfInput) ->
      Error([
        dynamic.DecodeError("bad request: unexpected end of input", "", []),
      ])
  }
  |> result.map_error(decode_errs_to_string)
}

fn decode_errs_to_string(errs: dynamic.DecodeErrors) -> String {
  list.fold(errs, "Error decoding message:", fn(err_string, err) {
    let dynamic.DecodeError(expected, found, _) = err
    err_string <> " expected: " <> expected <> ", found: " <> found <> ";"
  })
}
