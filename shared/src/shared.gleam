import gleam/dict.{type Dict}
import gleam/dynamic
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/pair
import gleam/result

pub type PlayerName =
  String

pub type RoomCode =
  String

pub type HttpRequest {
  CreateRoomRequest
  JoinRoomRequest(room_code: RoomCode)
}

pub type HttpResponse {
  // Returned from successfully creating/joining a room.
  RoomResponse(room: Room, player_id: Int)
}

pub type WebsocketRequest {
  AddWord(String)
  ListWords
  StartRound
  SubmitOrderedWords(List(String))
}

pub type WebsocketResponse {
  PlayersInRoom(List(Player))
  WordList(List(String))
  RoundInfo(
    leading_player: Player,
    options: List(String),
    waiting_for: List(Player),
  )
  ServerError(reason: String)
}

pub type Player {
  Player(id: Int, name: PlayerName)
}

fn player_to_json(player: Player) {
  json.object([
    #("id", json.int(player.id)),
    #("name", json.string(player.name)),
  ])
}

pub fn player_from_json(
  player: dynamic.Dynamic,
) -> Result(Player, List(dynamic.DecodeError)) {
  player
  |> dynamic.decode2(
    Player,
    dynamic.field("id", dynamic.int),
    dynamic.field("name", dynamic.string),
  )
}

type PlayerWithOrderedPreferences =
  #(Player, List(String))

fn player_with_preferences_to_json(p: PlayerWithOrderedPreferences) {
  json.object([
    #("player", player_to_json(p.0)),
    #("wordOrder", json.array(p.1, of: json.string)),
  ])
}

fn player_with_preferences_from_json(player_with_prefs: dynamic.Dynamic) {
  player_with_prefs
  |> dynamic.decode2(
    fn(player, prefs) { #(player, prefs) },
    dynamic.field("player", player_from_json),
    dynamic.field("wordOrder", dynamic.list(dynamic.string)),
  )
}

/// Round represents a round of the game within a room, where one player is
/// selecting their order of preferences out of some given list of words, and the
/// other players are trying to guess that ordering.
pub type Round {
  Round(
    words: List(String),
    // The leading player with their ordered preferences.
    leading_player: PlayerWithOrderedPreferences,
    // The other players with their guessed ordered words.
    other_players: List(PlayerWithOrderedPreferences),
  )
}

pub fn round_to_json(round: Round) {
  json.object([
    #("words", json.array(round.words, of: json.string)),
    #("leadingPlayer", player_with_preferences_to_json(round.leading_player)),
    #(
      "otherPlayers",
      json.array(round.other_players, of: player_with_preferences_to_json),
    ),
  ])
}

pub fn round_from_json(
  round: dynamic.Dynamic,
) -> Result(Round, List(dynamic.DecodeError)) {
  round
  |> dynamic.decode3(
    Round,
    dynamic.field("words", dynamic.list(dynamic.string)),
    dynamic.field("leadingPlayer", player_with_preferences_from_json),
    dynamic.field(
      "otherPlayers",
      dynamic.list(player_with_preferences_from_json),
    ),
  )
}

pub type Room {
  Room(
    room_code: RoomCode,
    players: Dict(Int, Player),
    word_list: List(String),
    round: Option(Round),
  )
}

pub fn room_to_json(room: Room) {
  json.object([
    #("roomCode", json.string(room.room_code)),
    #("players", json.array(dict.values(room.players), of: player_to_json)),
    #("wordList", json.array(room.word_list, of: json.string)),
    #("round", json.nullable(room.round, of: round_to_json)),
  ])
}

fn player_list_to_dict(
  player_list: dynamic.Dynamic,
) -> Result(Dict(Int, Player), List(dynamic.DecodeError)) {
  use players <- result.map(dynamic.list(player_from_json)(player_list))
  players
  |> list.map(fn(player) { #(player.id, player) })
  |> dict.from_list
}

pub fn room_from_json(
  room: dynamic.Dynamic,
) -> Result(Room, List(dynamic.DecodeError)) {
  room
  |> dynamic.decode4(
    Room,
    dynamic.field("roomCode", dynamic.string),
    dynamic.field("players", player_list_to_dict),
    dynamic.field("wordList", dynamic.list(dynamic.string)),
    dynamic.optional_field("round", round_from_json),
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
  |> json.to_string
}

pub fn encode_request(request: WebsocketRequest) {
  let #(t, message) =
    case request {
      AddWord(word) -> #("addWord", json.string(word))
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
      RoomResponse(room, player_id) -> #(
        "joinedRoom",
        json.object([
          #("room", room_to_json(room)),
          #("playerId", json.int(player_id)),
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
      PlayersInRoom(players) -> #(
        "playersInRoom",
        json.array(from: players, of: player_to_json),
      )
      WordList(word_list) -> #(
        "wordList",
        json.array(from: word_list, of: json.string),
      )
      RoundInfo(leading_player, options, waiting_for) -> #(
        "roundInfo",
        json.object([
          #("leadingPlayer", player_to_json(leading_player)),
          #("options", json.array(from: options, of: json.string)),
          #("waitingFor", json.array(from: waiting_for, of: player_to_json)),
        ]),
      )
      ServerError(reason) -> #("error", json.string(reason))
    }
    |> pair.map_first(json.string)
  json.object([#("type", t), #("message", message)])
  |> json.to_string
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
        dynamic.field("room", room_from_json),
        dynamic.field("playerId", dynamic.int),
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
    Ok(#("playersInRoom", msg)) ->
      msg
      |> dynamic.decode1(PlayersInRoom, dynamic.list(of: player_from_json))
    Ok(#("wordList", msg)) ->
      msg
      |> dynamic.decode1(WordList, dynamic.list(of: dynamic.string))
    Ok(#("roundInfo", msg)) ->
      msg
      |> dynamic.decode3(
        RoundInfo,
        dynamic.field("leadingPlayer", player_from_json),
        dynamic.field("options", dynamic.list(of: dynamic.string)),
        dynamic.field("waitingFor", dynamic.list(of: player_from_json)),
      )
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
