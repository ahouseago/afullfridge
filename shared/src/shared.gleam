import gleam/dynamic
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/pair
import gleam/result

pub type PlayerName {
  PlayerName(String)
}

pub type PlayerId {
  PlayerId(String)
}

pub type RoomCode {
  RoomCode(String)
}

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
  Player(id: PlayerId, name: PlayerName, connected: Bool)
}

pub type PlayerWithOrderedPreferences =
  #(PlayerId, List(String))

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

pub type FinishedRound {
  FinishedRound(
    words: List(String),
    leading_player_id: PlayerId,
    player_scores: List(PlayerScore),
  )
}

pub type PlayerScore {
  PlayerScore(player: Player, words: List(String), score: Int)
}

pub type ScoringMethod {
  // Scores one point for exactly matching the correct list.
  ExactMatch
  // Scores one point for every entry that is in the same position as the same
  // entry in the correct list.
  EqualPositions
  // Smart scoring awards points from 0 to 8, with 5 points as the highest
  // score with a single adjacent pair swapped.
  Smart
}

pub type Room {
  Room(
    room_code: RoomCode,
    players: List(Player),
    // All of the words that can be chosen from to create a round.
    word_list: List(String),
    round: Option(Round),
    finished_rounds: List(FinishedRound),
    scoring_method: ScoringMethod,
  )
}

pub fn player_name_to_string(player_name: PlayerName) -> String {
  let PlayerName(name) = player_name
  name
}

pub fn player_id_to_string(player_id: PlayerId) -> String {
  let PlayerId(id) = player_id
  id
}

pub fn room_code_to_string(room_code: RoomCode) -> String {
  let RoomCode(code) = room_code
  code
}

fn player_id_to_json(id: PlayerId) -> json.Json {
  player_id_to_string(id) |> json.string
}

fn room_code_to_json(room_code: RoomCode) -> json.Json {
  room_code_to_string(room_code) |> json.string
}

fn player_to_json(player: Player) {
  json.object([
    #("id", player.id |> player_id_to_string |> json.string),
    #("name", player.name |> player_name_to_string |> json.string),
    #("connected", player.connected |> json.bool),
  ])
}

fn from_dynamic_string(constructor: fn(String) -> a) {
  fn(str: dynamic.Dynamic) -> Result(a, List(dynamic.DecodeError)) {
    str |> dynamic.decode1(constructor, dynamic.string)
  }
}

pub fn player_from_json(
  player: dynamic.Dynamic,
) -> Result(Player, List(dynamic.DecodeError)) {
  player
  |> dynamic.decode3(
    Player,
    dynamic.field("id", from_dynamic_string(PlayerId)),
    dynamic.field("name", from_dynamic_string(PlayerName)),
    dynamic.field("connected", dynamic.bool),
  )
}

pub fn round_to_json(round: Round) -> json.Json {
  json.object([
    #("words", json.array(round.words, of: json.string)),
    #("leadingPlayerId", player_id_to_json(round.leading_player_id)),
    #("submitted", json.array(round.submitted, of: player_id_to_json)),
  ])
}

pub fn round_from_json(
  round: dynamic.Dynamic,
) -> Result(Round, List(dynamic.DecodeError)) {
  round
  |> dynamic.decode3(
    Round,
    dynamic.field("words", dynamic.list(dynamic.string)),
    dynamic.field("leadingPlayerId", from_dynamic_string(PlayerId)),
    dynamic.field("submitted", dynamic.list(from_dynamic_string(PlayerId))),
  )
}

pub fn finished_round_to_json(round: FinishedRound) -> json.Json {
  json.object([
    #("words", json.array(round.words, of: json.string)),
    #("leadingPlayerId", player_id_to_json(round.leading_player_id)),
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
    dynamic.field("leadingPlayerId", from_dynamic_string(PlayerId)),
    dynamic.field("scores", dynamic.list(player_score_from_json)),
  )
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

fn scoring_method_to_json(scoring_method: ScoringMethod) -> json.Json {
  case scoring_method {
    ExactMatch -> json.string("EXACT_MATCH")
    EqualPositions -> json.string("EQUAL_POSITIONS")
    Smart -> json.string("SMART")
  }
}

fn scoring_method_from_json(
  scoring_method: dynamic.Dynamic,
) -> Result(ScoringMethod, List(dynamic.DecodeError)) {
  case dynamic.string(scoring_method) {
    Ok("EXACT_MATCH") -> Ok(ExactMatch)
    Ok("EQUAL_POSITIONS") -> Ok(EqualPositions)
    Ok("SMART") -> Ok(Smart)
    Ok(method) ->
      Error([
        dynamic.DecodeError(expected: "scoring method", found: method, path: []),
      ])
    Error(a) -> Error(a)
  }
}

pub fn room_to_json(room: Room) -> json.Json {
  json.object([
    #("roomCode", room_code_to_json(room.room_code)),
    #("players", json.array(room.players, of: player_to_json)),
    #("wordList", json.array(room.word_list, of: json.string)),
    #("round", json.nullable(room.round, of: round_to_json)),
    #(
      "finishedRounds",
      json.array(room.finished_rounds, of: finished_round_to_json),
    ),
    #("scoringMethod", scoring_method_to_json(room.scoring_method)),
  ])
}

pub fn room_from_json(
  room: dynamic.Dynamic,
) -> Result(Room, List(dynamic.DecodeError)) {
  room
  |> dynamic.decode6(
    Room,
    dynamic.field("roomCode", from_dynamic_string(RoomCode)),
    dynamic.field("players", dynamic.list(player_from_json)),
    dynamic.field("wordList", dynamic.list(dynamic.string)),
    dynamic.field("round", dynamic.optional(round_from_json)),
    dynamic.field("finishedRounds", dynamic.list(finished_round_from_json)),
    dynamic.field("scoringMethod", scoring_method_from_json),
  )
}

pub fn encode_http_request(request: HttpRequest) {
  let #(t, message) =
    case request {
      CreateRoomRequest -> #("createRoom", json.null())
      JoinRoomRequest(room_code) -> #("joinRoom", room_code_to_json(room_code))
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
      |> dynamic.decode1(JoinRoomRequest, from_dynamic_string(RoomCode))
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
          #("roomCode", room_code_to_json(room_code)),
          #("playerId", player_id_to_json(player_id)),
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
        dynamic.field("roomCode", from_dynamic_string(RoomCode)),
        dynamic.field("playerId", from_dynamic_string(PlayerId)),
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
        dynamic.field("roomCode", from_dynamic_string(RoomCode)),
        dynamic.field("playerId", from_dynamic_string(PlayerId)),
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
